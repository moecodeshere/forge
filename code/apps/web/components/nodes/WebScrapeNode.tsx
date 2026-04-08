"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import { getNodeIcon } from "@/lib/nodes/icons";
import type { ForgeNode, ForgeNodeData } from "@/lib/stores/graphStore";

export function WebScrapeNode({ id, data, selected }: NodeProps<ForgeNode>) {
  const cfg = (data as ForgeNodeData | undefined)?.config ?? {};
  const url = String((cfg as Record<string, unknown>).url ?? "");
  const urlPreview = url ? (url.length > 35 ? `${url.slice(0, 32)}…` : url) : "URL from input or config";
  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title={(data as ForgeNodeData | undefined)?.label || "Web Scrape"}
      subtitle={urlPreview}
      colorClass="bg-amber-600/30 text-amber-200"
      icon={getNodeIcon("web_scrape")}
      badges={!url ? ["Set URL"] : []}
    />
  );
}
