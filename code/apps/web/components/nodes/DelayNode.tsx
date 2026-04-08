"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import { getNodeIcon } from "@/lib/nodes/icons";
import type { ForgeNode } from "@/lib/stores/graphStore";

export function DelayNode({
  id,
  data,
  selected,
}: NodeProps<ForgeNode>) {
  const config = (data.config ?? {}) as { seconds?: number };
  const seconds = config.seconds ?? 5;
  const subtitle = `${seconds}s delay`;

  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title="Delay"
      subtitle={subtitle}
      colorClass="bg-sky-600/30 text-sky-200"
      icon={getNodeIcon("delay")}
    />
  );
}
