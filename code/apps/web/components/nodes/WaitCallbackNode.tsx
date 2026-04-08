"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import { getNodeIcon } from "@/lib/nodes/icons";
import type { ForgeNode, ForgeNodeData } from "@/lib/stores/graphStore";

export function WaitCallbackNode({ id, data, selected }: NodeProps<ForgeNode>) {
  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title={(data as ForgeNodeData | undefined)?.label || "Wait for Callback"}
      subtitle="Pause → resume URL → POST to continue"
      colorClass="bg-amber-600/30 text-amber-200"
      icon={getNodeIcon("wait_callback")}
    />
  );
}
