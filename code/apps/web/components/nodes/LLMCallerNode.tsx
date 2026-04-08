"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import { getNodeIcon } from "@/lib/nodes/icons";
import type { ForgeNode } from "@/lib/stores/graphStore";

export function LLMCallerNode({ id, data, selected }: NodeProps<ForgeNode>) {
  const cfg = (data?.config ?? {}) as Record<string, unknown>;
  const model = String(cfg.model ?? "gpt-4o-mini");
  const temp = Number(cfg.temperature ?? 0.7);
  const subtitle = `${model} • ${temp} temp`;

  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title="LLM Caller"
      subtitle={subtitle}
      colorClass="bg-purple-600/30 text-purple-200"
      icon={getNodeIcon("llm_caller")}
    />
  );
}
