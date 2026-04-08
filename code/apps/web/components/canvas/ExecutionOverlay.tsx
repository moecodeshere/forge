"use client";

import { memo } from "react";
import type { NodeStatusMap } from "@/lib/hooks/useExecution";

interface ExecutionOverlayProps {
  nodeId: string;
  nodeStatuses: NodeStatusMap;
  tokenCount?: number;
}

const statusConfig = {
  pending: { ring: "ring-slate-400", bg: "bg-slate-50", label: "●", pulse: false },
  running: { ring: "ring-yellow-400", bg: "bg-yellow-50", label: "⟳", pulse: true },
  success: { ring: "ring-emerald-500", bg: "bg-emerald-50", label: "✓", pulse: false },
  error: { ring: "ring-red-500", bg: "bg-red-50", label: "✕", pulse: false },
  paused: { ring: "ring-purple-400", bg: "bg-purple-50", label: "⏸", pulse: false },
  skipped: { ring: "ring-slate-300", bg: "bg-slate-50", label: "↷", pulse: false },
} as const;

export const ExecutionOverlay = memo(function ExecutionOverlay({
  nodeId,
  nodeStatuses,
  tokenCount,
}: ExecutionOverlayProps) {
  const status = nodeStatuses[nodeId];
  if (!status) return null;

  const cfg = statusConfig[status] ?? statusConfig.pending;

  return (
    <>
      {/* Coloured ring around the node */}
      <div
        className={`pointer-events-none absolute inset-0 rounded-lg ring-2 ${cfg.ring} ${cfg.pulse ? "animate-pulse" : ""}`}
      />
      {/* Status badge — top-right corner */}
      <div
        className={`pointer-events-none absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-white ${cfg.bg} ${cfg.ring}`}
      >
        {cfg.label}
      </div>
      {/* Token counter badge — bottom-right, only for running LLM nodes */}
      {status === "running" && tokenCount !== undefined && tokenCount > 0 && (
        <div className="pointer-events-none absolute -bottom-2 -right-2 rounded-full bg-yellow-400 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-yellow-900 ring-2 ring-white">
          {tokenCount}t
        </div>
      )}
    </>
  );
});
