"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";
import { useCanvasActions } from "@/lib/contexts/CanvasActionsContext";

export function AddNodeEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps) {
  const actions = useCanvasActions();
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <>
      <BaseEdge path={edgePath} />
      {actions?.onAddBetween && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-zinc-600 bg-zinc-800 text-zinc-300 shadow hover:border-zinc-500 hover:bg-zinc-700 hover:text-white"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            onClick={(e) => {
              e.stopPropagation();
              actions.onAddBetween(id, source, target);
            }}
          >
            +
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
