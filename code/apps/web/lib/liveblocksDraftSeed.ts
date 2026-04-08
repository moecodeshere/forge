/**
 * When a draft (`forge:new`) is saved, we remount the Liveblocks room as `forge:<graphId>`.
 * This hands off the current graph so server-backed storage starts with the draft graph
 * instead of empty JSON (Strict Mode–safe via in-memory cache after first read).
 */

const SESSION_KEY_PREFIX = "forge.collab.seed.";

export type DraftGraphSnapshot = {
  nodesJson: string;
  edgesJson: string;
  v: number;
};

/** In-memory copy after reading sessionStorage — survives React Strict Mode double mount. */
const memorySeeds = new Map<string, DraftGraphSnapshot>();

export function stashDraftGraphForNewRoom(graphId: string, snapshot: DraftGraphSnapshot): void {
  memorySeeds.set(graphId, snapshot);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY_PREFIX + graphId, JSON.stringify(snapshot));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Returns initial `graph` storage for RoomProvider. Call once per room mount (e.g. useMemo).
 */
export function consumeLiveblocksInitialGraph(roomId: string): DraftGraphSnapshot {
  const id = roomId.startsWith("forge:") ? roomId.slice("forge:".length) : "";
  if (!id || id === "new") {
    return { nodesJson: "[]", edgesJson: "[]", v: 0 };
  }

  const fromMem = memorySeeds.get(id);
  if (fromMem) {
    return fromMem;
  }

  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY_PREFIX + id);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftGraphSnapshot;
        if (
          typeof parsed.nodesJson === "string" &&
          typeof parsed.edgesJson === "string" &&
          typeof parsed.v === "number"
        ) {
          memorySeeds.set(id, parsed);
          sessionStorage.removeItem(SESSION_KEY_PREFIX + id);
          return parsed;
        }
      }
    } catch {
      /* ignore */
    }
  }

  return { nodesJson: "[]", edgesJson: "[]", v: 0 };
}
