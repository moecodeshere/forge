"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import { getNodeIcon } from "@/lib/nodes/icons";
import type { ForgeNode } from "@/lib/stores/graphStore";

export function ConditionalBranchNode({ id, selected }: NodeProps<ForgeNode>) {
  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title="Conditional Branch"
      subtitle="Routes flow based on conditions"
      icon={getNodeIcon("conditional_branch")}
      colorClass="bg-amber-600/30 text-amber-200"
    />
  );
}
