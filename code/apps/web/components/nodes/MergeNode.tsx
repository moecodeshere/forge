"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import { getNodeIcon } from "@/lib/nodes/icons";
import type { ForgeNode } from "@/lib/stores/graphStore";

export function MergeNode({ id, data, selected }: NodeProps<ForgeNode>) {
  const cfg = (data?.config ?? {}) as { mode?: string };
  const mode = cfg.mode ?? "shallow";
  const subtitle = `Combine branches (${mode})`;

  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title="Merge"
      subtitle={subtitle}
      colorClass="bg-emerald-600/30 text-emerald-200"
      icon={getNodeIcon("merge")}
    />
  );
}
