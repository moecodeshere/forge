"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import { getNodeIcon } from "@/lib/nodes/icons";
import type { ForgeNode, ForgeNodeData } from "@/lib/stores/graphStore";

export function ResearchNode({ id, data, selected }: NodeProps<ForgeNode>) {
  const label = (data as ForgeNodeData | undefined)?.label;
  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title={label || "Web Research"}
      subtitle="Perplexity · query → report with sources"
      colorClass="bg-violet-600/30 text-violet-200"
      icon={getNodeIcon("research")}
    />
  );
}
