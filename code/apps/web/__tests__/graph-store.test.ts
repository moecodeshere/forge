import { beforeEach, describe, expect, it } from "vitest";

import type { ForgeNode } from "@/lib/stores/graphStore";
import { useGraphStore } from "@/lib/stores/graphStore";

const baseNodes: ForgeNode[] = [
  {
    id: "node-1",
    type: "llm_caller",
    position: { x: 10, y: 20 },
    data: { label: "LLM", config: {} },
  },
];

describe("graphStore history controls", () => {
  beforeEach(() => {
    useGraphStore.getState().resetGraph();
  });

  it("tracks canUndo/canRedo across undo and redo", () => {
    const store = useGraphStore.getState();

    store.setNodes(baseNodes);
    store.pushHistory();
    expect(useGraphStore.getState().canUndo).toBe(true);
    expect(useGraphStore.getState().canRedo).toBe(false);

    store.setNodes([
      ...baseNodes,
      {
        id: "node-2",
        type: "rag_retriever",
        position: { x: 40, y: 60 },
        data: { label: "RAG", config: {} },
      },
    ]);

    store.undo();
    expect(useGraphStore.getState().nodes).toHaveLength(1);
    expect(useGraphStore.getState().canRedo).toBe(true);

    store.redo();
    expect(useGraphStore.getState().nodes).toHaveLength(2);
    expect(useGraphStore.getState().canUndo).toBe(true);
  });

  it("replaceGraph resets history and clean state", () => {
    const store = useGraphStore.getState();
    store.setNodes(baseNodes);
    store.pushHistory();

    store.replaceGraph(baseNodes, []);

    const next = useGraphStore.getState();
    expect(next.isDirty).toBe(false);
    expect(next.canUndo).toBe(false);
    expect(next.canRedo).toBe(false);
    expect(next.undoStack).toHaveLength(0);
    expect(next.redoStack).toHaveLength(0);
  });
});

