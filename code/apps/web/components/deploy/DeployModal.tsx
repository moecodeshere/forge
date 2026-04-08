"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type DeployTarget = "cloud" | "mcp" | "code" | "docker";

interface DeployModalProps {
  graphId: string;
  graphTitle: string;
  onClose: () => void;
}

interface DeployResult {
  deployment_id?: string;
  deployment_url?: string;
  download_url?: string | null;
  path?: string;
  manifest?: Record<string, unknown> | string;
  mcp_url?: string;
  /** When storage bucket is missing, API returns ZIP as base64 so we can still offer download */
  download_base64?: string;
  filename?: string;
}

const targets: { id: DeployTarget; label: string; description: string; icon: string }[] = [
  {
    id: "cloud",
    label: "Cloud (Vercel)",
    description: "Deploy as a serverless function with a live HTTPS endpoint",
    icon: "☁️",
  },
  {
    id: "mcp",
    label: "MCP Server",
    description: "Expose as a Model Context Protocol JSON-RPC server",
    icon: "🔌",
  },
  {
    id: "code",
    label: "Export Code",
    description: "Download a LangGraph Python project ZIP",
    icon: "📦",
  },
  {
    id: "docker",
    label: "Docker",
    description: "Download a Dockerfile + docker-compose bundle",
    icon: "🐳",
  },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function DeployModal({ graphId, graphTitle, onClose }: DeployModalProps) {
  const [selectedTarget, setSelectedTarget] = useState<DeployTarget>("cloud");
  const [exposeAsMcp, setExposeAsMcp] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<DeployResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDeploy() {
    setIsDeploying(true);
    setError(null);
    setResult(null);
    setProgress(10);

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";
      setProgress(30);

      const resp = await fetch(`${API_URL}/deployments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          graph_id: graphId,
          deploy_type: selectedTarget,
          expose_as_mcp: selectedTarget === "cloud" ? exposeAsMcp : undefined,
        }),
      });
      setProgress(70);

      if (!resp.ok) {
        const err = (await resp.json()) as { detail?: string };
        throw new Error(err.detail ?? "Deployment failed");
      }

      const json = (await resp.json()) as DeployResult;
      setResult(json);
      setProgress(100);
      // If API returned inline ZIP (e.g. storage bucket not set up), trigger download
      if (json.download_base64 && json.filename) {
        try {
          const bin = atob(json.download_base64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const blob = new Blob([bytes], { type: "application/zip" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = json.filename;
          a.click();
          URL.revokeObjectURL(url);
        } catch {
          // Ignore; user still sees success and can retry or use storage later
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deployment failed");
    } finally {
      setIsDeploying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Deploy Graph
            </h2>
            <p className="text-sm text-slate-500">{graphTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {/* Webhook URL — always available for saved workflows */}
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
          <p className="mb-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            Webhook URL (trigger via POST)
          </p>
          <code className="block break-all text-xs text-slate-700 dark:text-slate-300">
            {API_URL}/webhooks/workflow/{graphId}
          </code>
          <button
            type="button"
            onClick={() => {
              const url = `${API_URL}/webhooks/workflow/${graphId}`;
              void navigator.clipboard.writeText(url);
            }}
            className="mt-2 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Copy URL
          </button>
        </div>

        {/* Expose as MCP — only when Cloud selected */}
        {selectedTarget === "cloud" && (
          <label className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <input
              type="checkbox"
              checked={exposeAsMcp}
              onChange={(e) => setExposeAsMcp(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Expose as MCP — Add to Claude or Cursor
            </span>
          </label>
        )}

        {/* Target picker */}
        <div className="mb-5 grid grid-cols-2 gap-2">
          {targets.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTarget(t.id)}
              className={`rounded-xl border p-3 text-left transition ${
                selectedTarget === t.id
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
                  : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
              }`}
            >
              <div className="mb-1 text-xl">{t.icon}</div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {t.label}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500 leading-snug">{t.description}</div>
            </button>
          ))}
        </div>

        {/* Progress bar */}
        {isDeploying && (
          <div className="mb-4">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>Deploying…</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mb-4 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950">
            <p className="mb-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Deployment successful!
            </p>
            {result.mcp_url && (
              <div className="mb-3 rounded-lg border border-emerald-200 bg-white p-3 dark:border-emerald-800 dark:bg-slate-900">
                <p className="mb-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Add to Claude or Cursor
                </p>
                <p className="mb-2 text-[11px] text-slate-500">
                  In your MCP settings, add this URL as a remote MCP server. Use your Forge API token
                  as Bearer auth.
                </p>
                <code className="block break-all text-xs text-slate-700 dark:text-slate-300">
                  {result.mcp_url}
                </code>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(result.mcp_url!)}
                  className="mt-2 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Copy URL
                </button>
              </div>
            )}
            {result.deployment_url && (
              <a
                href={result.deployment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block break-all text-xs text-indigo-600 hover:underline"
              >
                {result.deployment_url}
              </a>
            )}
            {(result.download_url || (result.download_base64 && result.filename)) && (
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                {result.download_url ? (
                  <a
                    href={result.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-indigo-600 hover:underline"
                  >
                    ⬇ Download ZIP
                  </a>
                ) : (
                  <>⬇ Download started (ZIP returned inline).</>
                )}
              </p>
            )}
            {result.manifest && (
              <div className="mt-2">
                <p className="mb-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  MCP manifest — add to Claude Desktop or other MCP clients
                </p>
                <div className="relative">
                  <pre className="overflow-auto rounded bg-white p-2 pr-12 text-[10px] text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    {JSON.stringify(
                      typeof result.manifest === "string"
                        ? JSON.parse(result.manifest)
                        : result.manifest,
                      null,
                      2,
                    )}
                  </pre>
                  <button
                    type="button"
                    onClick={() => {
                      const m =
                        typeof result!.manifest === "string"
                          ? result!.manifest
                          : JSON.stringify(result!.manifest, null, 2);
                      void navigator.clipboard.writeText(m);
                    }}
                    className="absolute right-2 top-2 rounded px-2 py-1 text-[10px] font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50 dark:border-slate-700"
          >
            Cancel
          </button>
          {!result && (
            <button
              onClick={handleDeploy}
              disabled={isDeploying}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isDeploying ? "Deploying…" : "Deploy"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
