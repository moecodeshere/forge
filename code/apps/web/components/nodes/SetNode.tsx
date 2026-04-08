"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import { getNodeIcon } from "@/lib/nodes/icons";
import type { ForgeNode, ForgeNodeData } from "@/lib/stores/graphStore";

export function SetNode({ id, data, selected }: NodeProps<ForgeNode>) {
  const cfg = (data as ForgeNodeData | undefined)?.config ?? {};
  const fields = Array.isArray((cfg as Record<string, unknown>).fields)
    ? ((cfg as Record<string, unknown>).fields as unknown[])
    : [];
  const count = fields.length;
  const firstKey =
    count > 0 && typeof fields[0] === "object" && fields[0] !== null && "key" in fields[0]
      ? String((fields[0] as Record<string, unknown>).key || "")
      : "";
  const subtitle =
    count === 0
      ? "Add, remove, rename fields"
      : firstKey
        ? `${count} field${count > 1 ? "s" : ""} (${firstKey}…)`
        : `${count} field${count > 1 ? "s" : ""}`;

  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title="Set"
      subtitle={subtitle}
      colorClass="bg-emerald-600/30 text-emerald-200"
      icon={getNodeIcon("set_node")}
    />
  );
}
