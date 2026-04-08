"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import { getNodeIcon } from "@/lib/nodes/icons";
import type { ForgeNode } from "@/lib/stores/graphStore";

export function ManualTriggerNode({ id, selected }: NodeProps<ForgeNode>) {
  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title="Manual Trigger"
      subtitle="Start workflow manually"
      colorClass="bg-amber-600/30 text-amber-200"
      icon={getNodeIcon("manual_trigger")}
    />
  );
}
