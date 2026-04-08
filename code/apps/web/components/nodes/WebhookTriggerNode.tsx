"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import type { ForgeNode } from "@/lib/stores/graphStore";

export function WebhookTriggerNode({ id, selected }: NodeProps<ForgeNode>) {
  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title="Webhook Trigger"
      subtitle="Start via HTTP POST"
      colorClass="bg-amber-600/30 text-amber-200"
    />
  );
}
