"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import { getNodeIcon } from "@/lib/nodes/icons";
import type { ForgeNode, ForgeNodeData } from "@/lib/stores/graphStore";

export function SqlQueryNode({ id, data, selected }: NodeProps<ForgeNode>) {
  const cfg = (data as ForgeNodeData | undefined)?.config ?? {};
  const query = String((cfg as Record<string, unknown>).query ?? "");
  const preview = query ? (query.length > 35 ? `${query.slice(0, 32)}…` : query) : "Configure query";
  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title={(data as ForgeNodeData | undefined)?.label || "SQL Query"}
      subtitle={preview}
      colorClass="bg-slate-600/30 text-slate-200"
      icon={getNodeIcon("sql_query")}
      badges={!query ? ["Configure"] : []}
    />
  );
}
