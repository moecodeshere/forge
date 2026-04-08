"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import { getNodeIcon } from "@/lib/nodes/icons";
import type { ForgeNode } from "@/lib/stores/graphStore";

export function ScheduleTriggerNode({ id, selected }: NodeProps<ForgeNode>) {
  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title="Schedule Trigger"
      subtitle="Run every day, hour, or custom interval"
      colorClass="bg-amber-600/30 text-amber-200"
      icon={getNodeIcon("schedule_trigger")}
    />
  );
}
