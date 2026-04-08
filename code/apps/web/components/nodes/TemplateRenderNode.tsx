"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import { getNodeIcon } from "@/lib/nodes/icons";
import type { ForgeNode, ForgeNodeData } from "@/lib/stores/graphStore";

export function TemplateRenderNode({ id, data, selected }: NodeProps<ForgeNode>) {
  const cfg = (data as ForgeNodeData | undefined)?.config ?? {};
  const template = String((cfg as Record<string, unknown>).template ?? "");
  const preview = template ? (template.length > 30 ? `${template.slice(0, 27)}…` : template) : "{{input.x}}";
  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title={(data as ForgeNodeData | undefined)?.label || "Template (Render)"}
      subtitle={preview}
      colorClass="bg-cyan-600/30 text-cyan-200"
      icon={getNodeIcon("template_render")}
    />
  );
}
