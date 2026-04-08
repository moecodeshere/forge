"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import { getNodeIcon } from "@/lib/nodes/icons";
import type { ForgeNode, ForgeNodeData } from "@/lib/stores/graphStore";

export function LoopNode({ id, data, selected }: NodeProps<ForgeNode>) {
  const cfg = (data as ForgeNodeData | undefined)?.config ?? {};
  const arrayKey = String((cfg as Record<string, unknown>).array_key ?? "items");
  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title={(data as ForgeNodeData | undefined)?.label || "Loop (For Each)"}
      subtitle={`Over {{${arrayKey}}} → next node`}
      colorClass="bg-indigo-600/30 text-indigo-200"
      icon={getNodeIcon("loop")}
    />
  );
}
