import { describe, expect, it } from "vitest";

import {
  consumeLiveblocksInitialGraph,
  stashDraftGraphForNewRoom,
} from "@/lib/liveblocksDraftSeed";

describe("liveblocksDraftSeed", () => {
  it("returns empty graph for forge:new", () => {
    const g = consumeLiveblocksInitialGraph("forge:new");
    expect(g.nodesJson).toBe("[]");
    expect(g.edgesJson).toBe("[]");
    expect(g.v).toBe(0);
  });

  it("returns stashed snapshot for forge:<graphId>", () => {
    const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const snap = {
      nodesJson: '[{"id":"n1"}]',
      edgesJson: "[]",
      v: 17_000_000_000_000,
    };
    stashDraftGraphForNewRoom(id, snap);
    const g = consumeLiveblocksInitialGraph(`forge:${id}`);
    expect(g).toEqual(snap);
    const again = consumeLiveblocksInitialGraph(`forge:${id}`);
    expect(again).toEqual(snap);
  });
});
