"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import type { ForgeNode } from "@/lib/stores/graphStore";

export function ApprovalStepNode({ id, selected }: NodeProps<ForgeNode>) {
  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title="Approval Step"
      subtitle="Pauses execution for human input"
      colorClass="bg-rose-600/30 text-rose-200"
    />
  );
}
