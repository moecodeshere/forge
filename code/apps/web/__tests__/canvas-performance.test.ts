import { beforeEach, describe, expect, it } from "vitest";

import type { Edge } from "@xyflow/react";

import type { ForgeNode } from "@/lib/stores/graphStore";
import { useGraphStore } from "@/lib/stores/graphStore";

function createMediumGraph(size: number): { nodes: ForgeNode[]; edges: Edge[] } {
  const nodes: ForgeNode[] = Array.from({ length: size }, (_, i) => ({
    id: `node-${i}`,
    type: i % 2 === 0 ? "llm_caller" : "rag_retriever",
    position: { x: (i % 20) * 120, y: Math.floor(i / 20) * 100 },
    data: { label: `Node ${i}`, config: { idx: i } },
  }));
  const edges: Edge[] = Array.from({ length: size - 1 }, (_, i) => ({
    id: `edge-${i}`,
    source: `node-${i}`,
    target: `node-${i + 1}`,
  }));
  return { nodes, edges };
}

describe("canvas medium-graph responsiveness", () => {
  beforeEach(() => {
    useGraphStore.getState().resetGraph();
  });

  it("handles medium graph updates quickly", () => {
    const store = useGraphStore.getState();
    const { nodes, edges } = createMediumGraph(180);

    const start = performance.now();
    store.replaceGraph(nodes, edges);
    store.pushHistory();
    store.setNodes(
      nodes.map((node) =>
        node.id === "node-42" ? { ...node, position: { x: node.position.x + 20, y: node.position.y } } : node,
      ),
    );
    store.undo();
    store.redo();
    const elapsedMs = performance.now() - start;

    expect(elapsedMs).toBeLessThan(250);
  });
});

