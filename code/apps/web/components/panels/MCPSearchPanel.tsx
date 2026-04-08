"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

interface MCPTool {
  name: string;
  description?: string;
  server_url?: string;
  tags?: string[];
}

interface MCPSearchPanelProps {
  onToolDragStart?: (tool: MCPTool) => void;
  onAddToCanvas?: (tool: MCPTool) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function useDebounce<T>(value: T, ms = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export function MCPSearchPanel({ onToolDragStart, onAddToCanvas }: MCPSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MCPTool[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, 400);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token ?? "";

      const resp = await fetch(
        `${API_URL}/mcp/search?q=${encodeURIComponent(q)}&limit=20`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!resp.ok) throw new Error("Search failed");
      const json = (await resp.json()) as { results: MCPTool[] };
      setResults(json.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    search(debouncedQuery);
  }, [debouncedQuery, search]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        MCP Tool Search
      </div>
      <input
        type="search"
        placeholder="Search MCP tools…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900"
      />

      <div className="flex-1 overflow-y-auto space-y-2">
        {isLoading && (
          <p className="text-center text-xs text-slate-400">Searching…</p>
        )}
        {error && (
          <p className="text-center text-xs text-red-500">{error}</p>
        )}
        {!isLoading && !error && results.length === 0 && query.trim() && (
          <p className="text-center text-xs text-slate-400">No tools found</p>
        )}

        {results.map((tool) => (
          <ToolCard
            key={tool.name}
            tool={tool}
            onDragStart={onToolDragStart}
            onAdd={onAddToCanvas}
          />
        ))}
      </div>
    </div>
  );
}

function ToolCard({
  tool,
  onDragStart,
  onAdd,
}: {
  tool: MCPTool;
  onDragStart?: (t: MCPTool) => void;
  onAdd?: (t: MCPTool) => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart?.(tool)}
      className="group cursor-grab rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm transition hover:border-indigo-300 hover:shadow dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
            {tool.name}
          </p>
          {tool.description && (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{tool.description}</p>
          )}
          {tool.tags && tool.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {tool.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => onAdd?.(tool)}
          className="shrink-0 rounded-md bg-indigo-500 px-2 py-1 text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100 hover:bg-indigo-600"
        >
          Add
        </button>
      </div>
    </div>
  );
}
