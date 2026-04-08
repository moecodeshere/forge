"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import { getNodeIcon } from "@/lib/nodes/icons";
import type { ForgeNode, ForgeNodeData } from "@/lib/stores/graphStore";

export function PdfReportNode({ id, data, selected }: NodeProps<ForgeNode>) {
  const cfg = (data as ForgeNodeData | undefined)?.config ?? {};
  const contentKey = String((cfg as Record<string, unknown>).content_key ?? "output");
  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title={(data as ForgeNodeData | undefined)?.label || "PDF Report"}
      subtitle={`From ${contentKey} → PDF`}
      colorClass="bg-rose-600/30 text-rose-200"
      icon={getNodeIcon("pdf_report")}
    />
  );
}
