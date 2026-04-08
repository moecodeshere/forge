"use client";

import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "@/components/nodes/BaseNode";
import type { ForgeNode } from "@/lib/stores/graphStore";

export function FormSubmissionTriggerNode({ id, selected }: NodeProps<ForgeNode>) {
  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      title="Form Submission"
      subtitle="Start via webform responses"
      colorClass="bg-amber-600/30 text-amber-200"
    />
  );
}
