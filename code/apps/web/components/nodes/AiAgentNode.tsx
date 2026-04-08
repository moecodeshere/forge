"use client";

import type { NodeProps } from "@xyflow/react";

import { BaseNode } from "@/components/nodes/BaseNode";
import type { ForgeNode, ForgeNodeData } from "@/lib/stores/graphStore";

export function AiAgentNode({ id, data, selected }: NodeProps<ForgeNode>) {
  const cfg = (data as ForgeNodeData | undefined)?.config ?? {};
  const model = String((cfg as Record<string, unknown>).model ?? "gpt-4o-mini");
  const tools = Array.isArray((cfg as Record<string, unknown>).tools)
    ? ((cfg as Record<string, unknown>).tools as string[])
    : [];
  const memorySource = String((cfg as Record<string, unknown>).memory_source ?? "");
  const outputMode = String((cfg as Record<string, unknown>).output_mode ?? "text");

  const badges: string[] = [];
  if (model) badges.push(model);
  if (tools.length > 0) badges.push(`${tools.length} tool${tools.length > 1 ? "s" : ""}`);
  if (memorySource) badges.push(`Memory: ${memorySource}`);
  badges.push(outputMode === "json" ? "JSON output" : "Text output");

  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title="AI Agent"
      subtitle="Multi-step agent with tools and memory"
      colorClass="bg-purple-600/30 text-purple-200"
      badges={badges}
    />
  );
}

