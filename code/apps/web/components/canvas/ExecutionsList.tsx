"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { listExecutions } from "@/lib/api/executions";
import type { ExecutionRun } from "@/lib/api/executions";

function formatDuration(startedAt: string, completedAt?: string): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const ms = Math.max(0, end - start);
  if (ms >= 60000) return `${Math.round(ms / 60000)}m`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function statusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "failed":
    case "cancelled":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "running":
    case "pending":
      return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
    case "paused":
      return <span className="text-purple-400">⏸</span>;
    default:
      return null;
  }
}

interface ExecutionsListProps {
  graphId: string | undefined;
  runId: string | null;
  isRunning: boolean;
  onSwitchToEditor?: () => void;
}

export function ExecutionsList({
  graphId,
  runId,
  isRunning,
  onSwitchToEditor,
}: ExecutionsListProps) {
  const [runs, setRuns] = useState<ExecutionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listExecutions(graphId)
      .then(({ runs: data }) => {
        if (!cancelled) setRuns(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [graphId, isRunning]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <span className="text-sm font-medium text-zinc-200">Executions</span>
        {isRunning && runId && (
          <span className="flex items-center gap-1.5 text-xs text-yellow-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Running…{" "}
            {onSwitchToEditor && (
              <button
                type="button"
                onClick={onSwitchToEditor}
                className="text-emerald-400 hover:underline"
              >
                View logs
              </button>
            )}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center gap-2 py-4 text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        )}
        {error && (
          <div className="rounded-md bg-red-950/50 p-3 text-sm text-red-400">{error}</div>
        )}
        {!loading && !error && runs.length === 0 && (
          <p className="py-6 text-center text-sm text-zinc-500">
            No runs yet. Click Run to execute this workflow.
          </p>
        )}
        {!loading && !error && runs.length > 0 && (
          <ul className="space-y-2">
            {runs.map((r) => {
              const isExpanded = expandedId === r.id;
              return (
                <li
                  key={r.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/50"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    className="flex w-full items-center gap-2 p-3 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
                    )}
                    {statusIcon(r.status)}
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[11px] text-zinc-400">
                        {r.id.slice(0, 8)}…
                      </span>
                      <span className="text-xs text-zinc-300">
                        {r.status} · {formatDuration(r.started_at, r.completed_at)}
                      </span>
                    </div>
                    <span className="shrink-0 text-[10px] text-zinc-500">
                      {new Date(r.started_at).toLocaleString()}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-zinc-800 px-4 py-2">
                      <p className="text-[11px] text-zinc-500">
                        Run ID: <span className="font-mono text-zinc-400">{r.id}</span>
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-500">
                        Started: {new Date(r.started_at).toLocaleString()}
                      </p>
                      {r.completed_at && (
                        <p className="text-[11px] text-zinc-500">
                          Completed: {new Date(r.completed_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
