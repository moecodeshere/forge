"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PresencePayload = {
  connectionId: number;
  userName: string;
  userColor: string;
  cursor: { x: number; y: number } | null;
  selectedNodeId: string | null;
  ts: number;
};

export interface RemotePresence {
  connectionId: number;
  presence: {
    cursor: { x: number; y: number } | null;
    selectedNodeId: string | null;
    userColor: string;
    userName: string;
  };
}

const COLORS = ["#8b5cf6", "#14b8a6", "#f59e0b", "#ef4444", "#3b82f6", "#22c55e"];
const STALE_MS = 8000;

function getSelfIdentity() {
  const base = Math.floor(Math.random() * 10_000_000);
  const color = COLORS[base % COLORS.length] ?? "#8b5cf6";
  return { connectionId: base, userName: `User-${String(base).slice(-4)}`, userColor: color };
}

export function useCollaboration(roomId: string) {
  const self = useMemo(() => getSelfIdentity(), []);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<RemotePresence[]>([]);

  const publish = (payload: Omit<PresencePayload, "connectionId" | "userName" | "userColor" | "ts">) => {
    const channel = channelRef.current;
    if (!channel) return;
    const event: PresencePayload = {
      connectionId: self.connectionId,
      userName: self.userName,
      userColor: self.userColor,
      cursor: payload.cursor,
      selectedNodeId: payload.selectedNodeId,
      ts: Date.now(),
    };
    channel.postMessage(event);
  };

  useEffect(() => {
    if (!roomId || roomId === "new") return;
    const channel = new BroadcastChannel(`forge-collab-${roomId}`);
    channelRef.current = channel;

    const byId = new Map<number, PresencePayload>();
    channel.onmessage = (evt: MessageEvent<PresencePayload>) => {
      const msg = evt.data;
      if (!msg || msg.connectionId === self.connectionId) return;
      byId.set(msg.connectionId, msg);

      const now = Date.now();
      for (const [id, item] of byId.entries()) {
        if (now - item.ts > STALE_MS) byId.delete(id);
      }

      setRemoteUsers(
        Array.from(byId.values()).map((item) => ({
          connectionId: item.connectionId,
          presence: {
            cursor: item.cursor,
            selectedNodeId: item.selectedNodeId,
            userColor: item.userColor,
            userName: item.userName,
          },
        })),
      );
    };

    const heartbeat = setInterval(() => {
      publish({ cursor: null, selectedNodeId: null });
    }, 2500);

    return () => {
      clearInterval(heartbeat);
      channel.close();
      channelRef.current = null;
      setRemoteUsers([]);
    };
  }, [roomId, self.connectionId, self.userColor, self.userName]);

  return {
    remoteUsers,
    updatePresence: (cursor: { x: number; y: number } | null, selectedNodeId: string | null) =>
      publish({ cursor, selectedNodeId }),
  };
}

