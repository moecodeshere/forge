/**
 * Liveblocks helpers. The canvas uses `@liveblocks/react` with `authEndpoint`
 * (`/api/liveblocks-auth`) and typings from `liveblocks.config.ts`.
 *
 * `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` is optional when using server-issued tokens only.
 */

export const liveblocksConfig = {
  publicApiKey: process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY ?? "",
  throttle: 16, // ~60fps
};

/** Mirrors `Presence` in `liveblocks.config.ts`. */
export type Presence = {
  cursor: { x: number; y: number } | null;
  selectedNodeId: string | null;
  userColor: string;
  userName: string;
};

/** Mirrors `Storage` in `liveblocks.config.ts` — versioned JSON graph snapshot. */
export type Storage = {
  graph: {
    nodesJson: string;
    edgesJson: string;
    v: number;
  };
};

export type UserMeta = {
  id: string;
  info: {
    name: string;
    color: string;
    avatar?: string;
  };
};

export type RoomEvent = {
  type: "node_locked" | "node_unlocked";
  nodeId: string;
  userId: string;
};
