"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import { getNodeIcon } from "@/lib/nodes/icons";
import type { ForgeNode, ForgeNodeData } from "@/lib/stores/graphStore";

export function HttpRequestNode({ id, data, selected }: NodeProps<ForgeNode>) {
  const cfg = (data as ForgeNodeData | undefined)?.config ?? {};
  const method = String((cfg as Record<string, unknown>).method ?? "GET");
  const url = String((cfg as Record<string, unknown>).url ?? "");
  const urlPreview = url ? (url.length > 40 ? `${url.slice(0, 37)}…` : url) : "No URL set";

  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title="HTTP Request"
      subtitle={`${method} ${urlPreview}`}
      colorClass="bg-sky-600/30 text-sky-200"
      icon={getNodeIcon("http_request")}
      badges={url ? [] : ["Configure"]}
    />
  );
}
