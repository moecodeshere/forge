"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import { getNodeIcon } from "@/lib/nodes/icons";
import type { ForgeNode, ForgeNodeData } from "@/lib/stores/graphStore";

export function ErrorHandlerNode({ id, data, selected }: NodeProps<ForgeNode>) {
  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title={(data as ForgeNodeData | undefined)?.label || "Error Handler"}
      subtitle="Runs when previous node fails"
      colorClass="bg-red-600/30 text-red-200"
      icon={getNodeIcon("error_handler")}
    />
  );
}
