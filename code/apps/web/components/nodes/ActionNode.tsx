"use client";

import type { NodeProps } from "@xyflow/react";

import { BaseNode } from "@/components/nodes/BaseNode";
import type { ForgeNode, ForgeNodeData } from "@/lib/stores/graphStore";

export function ActionNode({ id, data, selected }: NodeProps<ForgeNode>) {
  const nodeData = (data as ForgeNodeData | undefined)?.config ?? {};
  const provider = String((nodeData as Record<string, unknown>).provider ?? "");
  const action = String((nodeData as Record<string, unknown>).action ?? "");

  let title = "Action";
  let subtitle = "Gmail, Slack, Telegram, etc.";

  if (provider) {
    title = provider === "gmail" ? "Gmail" : provider.charAt(0).toUpperCase() + provider.slice(1);
    if (provider === "gmail") {
      if (action.includes("search")) {
        subtitle = "Fetch matching emails";
      } else if (action.includes("send")) {
        subtitle = "Send email";
      } else {
        subtitle = `gmail:${action || "action"}`;
      }
    } else {
      subtitle = `${provider}:${action || "action"}`;
    }
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
