"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import { getNodeIcon } from "@/lib/nodes/icons";
import type { ForgeNode, ForgeNodeData } from "@/lib/stores/graphStore";

export function SimpleLLMNode({ id, data, selected }: NodeProps<ForgeNode>) {
  const cfg = (data as ForgeNodeData | undefined)?.config ?? {};
  const model = String((cfg as Record<string, unknown>).model ?? "gpt-4o-mini");
  const prompt = String((cfg as Record<string, unknown>).prompt ?? "");
  const temperature = Number((cfg as Record<string, unknown>).temperature ?? 0.7);

  const trimmedPrompt = prompt.trim();
  const preview =
    trimmedPrompt.length === 0
      ? "No prompt configured yet"
      : trimmedPrompt.length > 60
        ? `${trimmedPrompt.slice(0, 57)}...`
        : trimmedPrompt;

  const badges: string[] = [];
  if (model) badges.push(model);
  badges.push(`Temp ${temperature}`);

  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title="Simple LLM"
      subtitle={preview}
      colorClass="bg-purple-600/30 text-purple-200"
      icon={getNodeIcon("simple_llm")}
      badges={badges}
    />
  );
}
