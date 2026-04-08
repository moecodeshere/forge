"use client";

import type { NodeProps } from "@xyflow/react";

import { BaseNode } from "@/components/nodes/BaseNode";
import type { ForgeNode, ForgeNodeData } from "@/lib/stores/graphStore";

export function MCPToolNode({ id, data, selected }: NodeProps<ForgeNode>) {
  const nodeData = (data as ForgeNodeData | undefined)?.config ?? {};
  const provider = String((nodeData as Record<string, unknown>).provider ?? "");
  const action = String((nodeData as Record<string, unknown>).action ?? "");
  const serverUrl = String((nodeData as Record<string, unknown>).server_url ?? "");
  const toolName = String((nodeData as Record<string, unknown>).tool_name ?? "");

  let title = "MCP Tool";
  let subtitle = "Run an integration or MCP tool";

  if (provider) {
    title = provider === "gmail" ? "Gmail" : provider.charAt(0).toUpperCase() + provider.slice(1);
    if (provider === "gmail") {
      if (action.includes("search")) {
        subtitle = "Fetch matching emails";
      } else if (action.includes("send")) {
        subtitle = "Send email";
      } else {
        subtitle = `Runs gmail:${action || "action"}`;
      }
    } else {
      subtitle = `Runs ${provider}:${action || "action"}`;
    }
  } else if (serverUrl) {
    title = "MCP Server";
    const url = new URL(serverUrl);
    const hostLabel = url.hostname.replace(/^www\./, "");
    subtitle = toolName ? `${hostLabel} · ${toolName}` : `${hostLabel} · MCP tool`;
  }

  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title={title}
      subtitle={subtitle}
      colorClass="bg-emerald-600/30 text-emerald-200"
    />
  );
}
