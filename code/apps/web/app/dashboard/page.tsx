"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Play, Sparkles, RefreshCw } from "lucide-react";

import type { GraphRecord } from "@/lib/api/graphs";
import { listGraphs } from "@/lib/api/graphs";
import { WORKFLOW_TEMPLATES } from "@/lib/templates/workflows";
import { formatRelativeTime } from "@/lib/utils";
import { ErrorAlert, getErrorHint } from "@/components/ui/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { GraphDeleteButton } from "@/components/dashboard/GraphDeleteButton";

const LOAD_TIMEOUT_MS = 10_000;

type ErrorKind = "auth" | "network" | "api" | "unknown";

function classifyError(err: unknown): { message: string; kind: ErrorKind } {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as Error & { status?: number }).status;

  if (
    /missing user session|sign in again|401|unauthorized|not authenticated/i.test(msg) ||
    status === 401
  ) {
    return {
      message: "Please sign in to see your workflows.",
      kind: "auth",
    };
  }
  if (
    /failed to fetch|network|connection refused|load failed|ERR_/i.test(msg) ||
    msg.includes("fetch")
  ) {
    return {
      message: "Could not reach the API. Ensure it's running and NEXT_PUBLIC_API_URL is correct.",
      kind: "network",
    };
  }
  if (
    status != null &&
    (status === 403 || status === 404 || status >= 500)
  ) {
    return {
      message: msg || "API error. Try again later.",
      kind: "api",
    };
  }
  return {
    message: msg || "Unable to load workflows.",
    kind: "unknown",
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [graphs, setGraphs] = useState<GraphRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const [loadingSlow, setLoadingSlow] = useState(false);

  const loadGraphs = useCallback(async () => {
    setError(null);
    setErrorKind(null);
    setIsLoading(true);
    setLoadingSlow(false);

    const timeoutId = setTimeout(() => {
      setLoadingSlow(true);
    }, LOAD_TIMEOUT_MS);

    try {
      const result = await listGraphs();
      setGraphs(result);
    } catch (err) {
      const { message, kind } = classifyError(err);
      setError(message);
      setErrorKind(kind);

      if (kind === "auth") {
        router.replace(`/login?next=${encodeURIComponent("/dashboard")}`);
        return;
      }
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadGraphs();
  }, [loadGraphs]);

  const isNewUser = !isLoading && !error && graphs.length === 0;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Create, edit, and deploy your AI workflow graphs.
            </p>
          </div>
          <Link
            href="/canvas/new"
            className="flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100"
          >
            <Sparkles className="h-4 w-4" />
            New Graph
          </Link>
        </div>

        {isNewUser && (
          <div className="mb-8 rounded-lg border border-emerald-800/50 bg-emerald-950/30 p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
              <Play className="h-4 w-4" />
              Get started with real use cases
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Pick a complex template below (invoice processing, lead qualification, RAG assistant, etc.)
              or use <strong>Create with AI</strong> to describe your workflow and have the graph built for you.
            </p>
          </div>
        )}

        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
              Create with AI
            </h2>
          </div>
          <Link
            href="/canvas/new?buildWithAI=1"
            className="mb-6 flex flex-col gap-2 rounded-lg border-2 border-dashed border-violet-600/50 bg-violet-950/20 p-6 transition hover:border-violet-500 hover:bg-violet-950/30"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-400" />
              <span className="text-sm font-semibold text-violet-200">Describe your workflow — we build it</span>
            </div>
            <p className="text-xs text-zinc-400">
              e.g. &quot;Lead form → AI qualification → store in Sheets; for high scores send Telegram with calendar link&quot;
              or &quot;Daily schedule → research AI news → summarize → send digest to Telegram&quot;
            </p>
          </Link>
        </section>

        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
              Complex templates
            </h2>
            <span className="text-xs text-zinc-500">Use-case driven · pick one and customize</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {WORKFLOW_TEMPLATES.map((template) => (
              <Link
                key={template.id}
                href={`/canvas/new?template=${template.id}`}
                className="group rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-600 hover:bg-zinc-900/80"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-zinc-100">{template.name}</h3>
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] uppercase text-zinc-400">
                    {template.category}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs text-zinc-400">{template.description}</p>
                {template.tags && template.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {template.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="rounded border border-zinc-700/80 bg-zinc-800/50 px-1.5 py-0.5 text-[10px] text-zinc-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-zinc-500">
                  ~{template.estimatedSetupMinutes} min
                  {template.billingHint ? ` · ${template.billingHint}` : ""}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {isLoading && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
              Your workflows
            </h2>
            {loadingSlow && (
              <p className="text-sm text-amber-400">
                Taking longer than usual. Check your connection and API status.
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
                >
                  <Skeleton className="mb-2 h-4 w-3/4" />
                  <Skeleton className="mb-3 h-3 w-full" />
                  <Skeleton className="mb-3 h-3 w-2/3" />
                  <div className="flex gap-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {error && errorKind !== "auth" && (
          <div className="space-y-3">
            <ErrorAlert
              message={error}
              hint={getErrorHint(error)}
              onDismiss={() => setError(null)}
            />
            <button
              type="button"
              onClick={() => void loadGraphs()}
              className="flex items-center gap-2 rounded-md border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && (
          <>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">
              Your workflows
            </h2>
            {graphs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 p-8 text-center">
                <p className="text-sm text-zinc-400">
                  No workflows yet. Start from a template above or create a new graph.
                </p>
                <Link
                  href="/canvas/new"
                  className="mt-4 inline-block rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
                >
                  Create blank workflow
                </Link>
              </div>
            ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {graphs.map((graph) => {
            const nodes = graph?.json_content?.nodes;
            const nodeCount = Array.isArray(nodes) ? nodes.length : 0;
            return (
              <div
                key={graph.id}
                className="group relative rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-600"
              >
                <Link href={`/canvas/${graph.id}`} className="block">
                  <h2 className="line-clamp-1 text-sm font-semibold">{graph.title ?? "Untitled"}</h2>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
                    {graph.description ?? "No description"}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                    <span>{nodeCount} nodes</span>
                    <span>Updated {formatRelativeTime(graph.updated_at)}</span>
                  </div>
                </Link>
                <div className="mt-2 flex gap-2">
                  <Link
                    href={`/canvas/${graph.id}`}
                    className="rounded bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700"
                  >
                    Edit
                  </Link>
                  <GraphDeleteButton graphId={graph.id} graphTitle={graph.title ?? "Untitled"} onDeleted={() => void loadGraphs()} />
                </div>
              </div>
            );
          })}
        </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
