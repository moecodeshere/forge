"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import type { ForgeNode } from "@/lib/stores/graphStore";

export function RAGRetrieverNode({ id, selected }: NodeProps<ForgeNode>) {
  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title="RAG Retriever"
      subtitle="Retrieves top documents from vector store"
      colorClass="bg-blue-600/30 text-blue-200"
    />
  );
}
