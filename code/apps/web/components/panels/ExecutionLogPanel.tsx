"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import type { ExecutionEvent, NodeStatusMap } from "@/lib/hooks/useExecution";

interface ExecutionLogPanelProps {
  events: ExecutionEvent[];
  tokenStreams: Record<string, string>;
  nodeStatuses: NodeStatusMap;
  isRunning: boolean;
  error: string | null;
  onApprove?: (approved: boolean, feedback?: string) => void;
}

const eventTypeLabel: Record<string, string> = {
  node_started: "▶ Node started",
  node_completed: "✓ Node completed",
  node_failed: "✕ Node failed",
  execution_completed: "✓ Execution completed",
  execution_failed: "✕ Execution failed",
  checkpoint_saved: "💾 Checkpoint saved",
  approval_required: "⏸ Approval required",
  token: "",
};

interface TimelineItem {
  nodeId: string;
  nodeType: string;
  status: string;
  durationMs: number;
  outputPreview: string;
}

function TimelineSection({
  items,
  formatDuration,
}: {
  items: TimelineItem[];
  formatDuration: (ms: number) => string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const hasError = items.some((i) => i.status === "error");
  const allSuccess = items.every((i) => i.status === "success" || i.status === "skipped");

  return (
    <div className="mb-2 grid grid-cols-1 gap-2">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <span>Timeline</span>
        {allSuccess && !hasError && (
          <span className="flex items-center gap-1 font-medium text-emerald-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
            All steps completed
          </span>
        )}
        {hasError && (
          <span className="flex items-center gap-1 font-medium text-red-500">
            <XCircle className="h-3.5 w-3.5" />
            Execution failed
          </span>
        )}
      </div>
      {items.map((item, idx) => {
        const isExpanded = expanded.has(item.nodeId);
        const hasOutput = !!item.outputPreview;
        return (
          <div
            key={`${item.nodeId}-${item.durationMs}-${idx}`}
            className="rounded border border-slate-800 bg-slate-900"
          >
            <button
              type="button"
              onClick={() => hasOutput && toggle(item.nodeId)}
              className="flex w-full items-center justify-between p-2 text-left"
            >
              <div className="flex items-center gap-2">
                {hasOutput ? (
                  isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                  )
                ) : (
                  <span className="w-4" />
                )}
                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                  {item.nodeType.replace(/_/g, " ")} — {item.nodeId.slice(0, 8)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  {formatDuration(item.durationMs)}
                </span>
                <span
                  className={
                    item.status === "error"
                      ? "font-semibold text-red-400"
                      : "font-medium text-emerald-400"
                  }
                >
                  {item.status}
                </span>
              </div>
            </button>
            {hasOutput && isExpanded && (
              <div className="border-t border-slate-800 px-2 py-2">
                <p className="break-all font-mono text-[11px] text-emerald-300">
                  {item.outputPreview}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const eventTypeColor: Record<string, string> = {
  node_started: "text-yellow-600",
  node_completed: "text-emerald-600",
  node_failed: "text-red-600",
  execution_completed: "text-emerald-700 font-semibold",
  execution_failed: "text-red-700 font-semibold",
  checkpoint_saved: "text-blue-500",
  approval_required: "text-purple-600",
  token: "text-slate-700 font-mono text-xs",
};

export function ExecutionLogPanel({
  events,
  tokenStreams,
  nodeStatuses,
  isRunning,
  error,
  onApprove,
}: ExecutionLogPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [approvalFeedback, setApprovalFeedback] = useState("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const approvalEvent = events.findLast((e) => e.event_type === "approval_required");
  const pendingApproval = approvalEvent && nodeStatuses[approvalEvent.node_id ?? ""] === "paused";

  useEffect(() => {
    if (!pendingApproval) setApprovalFeedback("");
  }, [pendingApproval]);

  const filteredEvents = events.filter((e) => e.event_type !== "token");

  // Build per-node LLM output for display
  const llmOutputNodes = Object.entries(tokenStreams).filter(([, v]) => v.length > 0);
  const errorHints: Array<{ match: RegExp; hint: string }> = [
    {
      match: /api key|openai_api_key|authentication.*key|incorrect api key/i,
      hint: "Enter your API key in Run settings on the canvas (click Run settings), then run again.",
    },
    {
      match: /not authenticated|missing user session|401|unauthorized/i,
      hint: "Sign out and sign in again, then retry the run.",
    },
    {
      match: /csp|content security policy|refused to connect/i,
      hint: "Check NEXT_PUBLIC_API_URL and web CSP configuration, then restart web server.",
    },
    {
      match: /timed out|timeout/i,
      hint: "Retry the run or reduce workload size; external services may be slow.",
    },
    {
      match: /rate|429|too many requests/i,
      hint: "You hit a rate limit. Wait briefly and retry.",
    },
  ];
  const errorHint = error
    ? errorHints.find((entry) => entry.match.test(error))?.hint ??
      "Open run logs and inspect the failing node input/output to troubleshoot."
    : null;
  function formatDuration(ms: number): string {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms}ms`;
  }

  const nodeStartedAt: Record<string, number> = {};
  const nodeTypeByNodeId: Record<string, string> = {};
  const nodeDurations: Array<{
    nodeId: string;
    nodeType: string;
    status: string;
    durationMs: number;
    outputPreview: string;
  }> = [];
  for (const evt of events) {
    if (!evt.node_id) continue;
    const ts = evt.timestamp ? new Date(evt.timestamp).getTime() : Date.now();
    if (evt.event_type === "node_started") {
      nodeStartedAt[evt.node_id] = ts;
      const nt = (evt.data as { node_type?: string }).node_type;
      if (nt) nodeTypeByNodeId[evt.node_id] = nt;
    }
    if (evt.event_type === "node_completed" || evt.event_type === "node_failed") {
      const started = nodeStartedAt[evt.node_id] ?? ts;
      const status = evt.event_type === "node_failed" ? "error" : String(evt.data.status ?? "success");
      const output = (evt.data as { output?: unknown }).output;
      const outputPreview =
        output === undefined ? "" : JSON.stringify(output).slice(0, 140);
      nodeDurations.push({
        nodeId: evt.node_id,
        nodeType: nodeTypeByNodeId[evt.node_id] ?? "node",
        status,
        durationMs: Math.max(0, ts - started),
        outputPreview,
      });
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-zinc-950 text-xs text-zinc-200">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-zinc-900 px-4 py-2">
        <span className="text-[11px] font-medium text-zinc-400">Logs</span>
        <div className="flex items-center gap-3">
          {isRunning && (
            <span className="flex items-center gap-1 text-[11px] text-yellow-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />
              Running…
            </span>
          )}
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
          >
            ···
          </button>
        </div>
      </div>

      {/* Log stream */}
      <div className="flex-1 overflow-y-auto space-y-1 px-4 py-2">
        {nodeDurations.length > 0 && (
          <TimelineSection items={nodeDurations} formatDuration={formatDuration} />
        )}
        {filteredEvents.map((evt, i) => {
          const label = eventTypeLabel[evt.event_type] ?? evt.event_type;
          if (!label) return null;
          const color = eventTypeColor[evt.event_type] ?? "text-slate-300";
          const ts = evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : "";
          return (
            <div key={i} className="flex gap-2 text-xs">
              <span className="shrink-0 text-slate-600">{ts}</span>
              <span className={color}>
                {label}
                {evt.node_id && (
                  <span className="ml-1 text-slate-500">({evt.node_id.slice(0, 8)})</span>
                )}
              </span>
            </div>
          );
        })}

        {/* LLM streaming output sections */}
        {llmOutputNodes.map(([nodeId, text]) => (
          <div key={nodeId} className="mt-2 rounded bg-slate-900 p-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              LLM Output — {nodeId.slice(0, 8)}
            </div>
            <p className="whitespace-pre-wrap font-mono text-xs text-emerald-300">{text}</p>
          </div>
        ))}

        {error && (
          <div className="rounded bg-red-950 p-2 text-xs text-red-400">
            <strong>Error:</strong> {error}
            {errorHint && <p className="mt-1 text-red-300">Suggested fix: {errorHint}</p>}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Approval gate UI — clear "Waiting for approval" with approve/reject + optional feedback */}
      {pendingApproval && onApprove && (
        <div className="rounded-lg border-2 border-purple-600 bg-purple-950/90 p-4">
          <p className="mb-2 text-sm font-semibold text-purple-200">
            ⏸ Waiting for approval
          </p>
          <p className="mb-3 text-xs text-purple-300/90">
            Node <span className="font-mono">{approvalEvent?.node_id?.slice(0, 8)}</span> requires human approval to continue.
          </p>
          <div className="mb-3">
            <label htmlFor="approval-feedback" className="mb-1 block text-[11px] text-purple-300/80">
              Optional feedback (passed to workflow)
            </label>
            <input
              id="approval-feedback"
              type="text"
              value={approvalFeedback}
              onChange={(e) => setApprovalFeedback(e.target.value)}
              placeholder="e.g. Looks good, proceed"
              className="w-full rounded border border-purple-700 bg-purple-950/50 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-purple-500 focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") onApprove(true, approvalFeedback.trim() || undefined);
              }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onApprove(true, approvalFeedback.trim() || undefined)}
              className="rounded bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              Approve
            </button>
            <button
              onClick={() => onApprove(false, approvalFeedback.trim() || undefined)}
              className="rounded bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
