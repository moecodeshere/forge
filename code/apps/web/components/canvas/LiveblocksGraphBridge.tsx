"use client";

/**
 * Syncs Zustand graph store ↔ Liveblocks Storage (versioned JSON).
 * Remote updates win when storage version is newer (LWW per version counter).
 */
import type { LiveObject } from "@liveblocks/client";
import { useCallback, useEffect, useRef } from "react";
import { useMutation, useStorage } from "@liveblocks/react";

import { useGraphStore } from "@/lib/stores/graphStore";

type GraphStorage = {
  nodesJson: string;
  edgesJson: string;
  v: number;
};

export function LiveblocksGraphBridge() {
  const graph = useStorage((root) => root.graph as GraphStorage | undefined);
  const updateRemote = useMutation(
    ({ storage }, payload: { nodesJson: string; edgesJson: string; v: number }) => {
      const g = storage.get("graph") as unknown as LiveObject<GraphStorage> | undefined;
      if (!g) return;
      g.set("nodesJson", payload.nodesJson);
      g.set("edgesJson", payload.edgesJson);
      g.set("v", payload.v);
    },
    [],
  );

  const lastRemoteV = useRef(0);
  const lastLocalPushV = useRef(0);
  const skipNextStorePush = useRef(false);
  const seeded = useRef(false);

  useEffect(() => {
    if (!graph) return;
    const v = graph.v;
    if (v === 0 && !seeded.current) {
      const { nodes, edges } = useGraphStore.getState();
      if (nodes.length > 0 || edges.length > 0) {
        seeded.current = true;
        const nextV = Date.now();
        lastLocalPushV.current = nextV;
        skipNextStorePush.current = true;
        updateRemote({
          nodesJson: JSON.stringify(nodes),
          edgesJson: JSON.stringify(edges),
          v: nextV,
        });
      }
      return;
    }
    if (v > lastRemoteV.current && v !== lastLocalPushV.current) {
      lastRemoteV.current = v;
      skipNextStorePush.current = true;
      try {
        const nodes = JSON.parse(graph.nodesJson) as unknown;
        const edges = JSON.parse(graph.edgesJson) as unknown;
        if (Array.isArray(nodes) && Array.isArray(edges)) {
          useGraphStore.getState().replaceGraph(nodes as never[], edges as never[]);
        }
      } catch {
        /* ignore malformed payload */
      }
    }
  }, [graph, updateRemote]);

  const pushDebounced = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(() => {
    const { nodes, edges } = useGraphStore.getState();
    const nextV = Date.now();
    lastLocalPushV.current = nextV;
    updateRemote({
      nodesJson: JSON.stringify(nodes),
      edgesJson: JSON.stringify(edges),
      v: nextV,
    });
  }, [updateRemote]);

  useEffect(() => {
    let prevN = useGraphStore.getState().nodes;
    let prevE = useGraphStore.getState().edges;
    const unsub = useGraphStore.subscribe(() => {
      const { nodes, edges } = useGraphStore.getState();
      if (nodes === prevN && edges === prevE) return;
      prevN = nodes;
      prevE = edges;
      if (skipNextStorePush.current) {
        skipNextStorePush.current = false;
        return;
      }
      if (pushDebounced.current) clearTimeout(pushDebounced.current);
      pushDebounced.current = setTimeout(flush, 400);
    });
    return () => {
      unsub();
      if (pushDebounced.current) clearTimeout(pushDebounced.current);
    };
  }, [flush]);

  return null;
}
