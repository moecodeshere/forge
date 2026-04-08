"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import type { ForgeNode } from "@/lib/stores/graphStore";

export function AppEventTriggerNode({ id, selected }: NodeProps<ForgeNode>) {
  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title="App Event"
      subtitle="Runs when something happens in an app"
      colorClass="bg-amber-600/30 text-amber-200"
    />
  );
}
