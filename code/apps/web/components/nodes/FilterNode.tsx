"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import { getNodeIcon } from "@/lib/nodes/icons";
import type { ForgeNode } from "@/lib/stores/graphStore";

export function FilterNode({ id, data, selected }: NodeProps<ForgeNode>) {
  const cfg = (data?.config ?? {}) as { source_key?: string; expr?: string };
  const sourceKey = cfg.source_key ?? "data";
  const expr = cfg.expr ?? "{{item}}";
  const subtitle = `${sourceKey} by ${expr}`;

  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title="Filter"
      subtitle={subtitle}
      colorClass="bg-amber-600/30 text-amber-200"
      icon={getNodeIcon("filter")}
    />
  );
}
