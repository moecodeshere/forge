"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import type { ForgeNode } from "@/lib/stores/graphStore";

export function JsonStringifyNode({ id, data, selected }: NodeProps<ForgeNode>) {
  const cfg = (data?.config ?? {}) as { source_key?: string };
  const sourceKey = cfg.source_key ?? "data";
  const subtitle = `${sourceKey} → JSON string`;

  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title="JSON Stringify"
      subtitle={subtitle}
      colorClass="bg-emerald-600/30 text-emerald-200"
    />
  );
}
