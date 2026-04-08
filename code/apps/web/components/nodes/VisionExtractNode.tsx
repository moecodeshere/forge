"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import { getNodeIcon } from "@/lib/nodes/icons";
import type { ForgeNode, ForgeNodeData } from "@/lib/stores/graphStore";

export function VisionExtractNode({ id, data, selected }: NodeProps<ForgeNode>) {
  const label = (data as ForgeNodeData | undefined)?.label;
  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title={label || "Extract from Image"}
      subtitle="Vision model · image → structured data"
      colorClass="bg-emerald-600/30 text-emerald-200"
      icon={getNodeIcon("vision_extract")}
    />
  );
}
