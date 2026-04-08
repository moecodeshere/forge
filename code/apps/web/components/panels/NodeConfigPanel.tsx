"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { z } from "zod";

import { ingestRagDocuments } from "@/lib/api/executions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ForgeNodeData, ForgeNodeType } from "@/lib/stores/graphStore";

// Dropdown options for quick selection
const LLM_MODELS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4-turbo",
  "claude-3-5-sonnet-20241022",
  "claude-3-haiku-20240307",
  "gemini-2.0-flash",
  "gemini-1.5-pro",
] as const;

const INTEGRATION_PROVIDERS = [
  { value: "gmail", label: "Gmail" },
  { value: "slack", label: "Slack" },
  { value: "sheets", label: "Google Sheets" },
  { value: "notion", label: "Notion" },
  { value: "telegram", label: "Telegram" },
  { value: "data_table", label: "Data Table" },
  { value: "pinecone", label: "Pinecone" },
  { value: "openai", label: "OpenAI" },
] as const;

const PROVIDER_ACTIONS: Record<string, { value: string; label: string }[]> = {
  gmail: [
    { value: "send_email", label: "Send email" },
    { value: "search_messages", label: "Search / fetch emails" },
  ],
  slack: [
    { value: "post_message", label: "Post message" },
  ],
  sheets: [
    { value: "append_row", label: "Append row" },
    { value: "read_range", label: "Read range" },
  ],
  notion: [
    { value: "create_page", label: "Create page" },
    { value: "query_database", label: "Query database" },
  ],
  telegram: [
    { value: "send_message", label: "Send message" },
    { value: "send_message_with_image", label: "Send message with image" },
  ],
  data_table: [
    { value: "insert_row", label: "Insert row" },
  ],
  pinecone: [
    { value: "query_vectors", label: "Query vectors" },
    { value: "upsert_vectors", label: "Upsert vectors" },
  ],
  openai: [
    { value: "generate_image", label: "Generate image" },
  ],
};

function getActionsForProvider(provider: string): { value: string; label: string }[] {
  return PROVIDER_ACTIONS[provider] ?? [{ value: "post_message", label: "Post message" }];
}

const llmSchema = z.object({
  model: z.string().min(1),
  system_prompt: z.string().optional(),
  temperature: z.number().min(0).max(1),
  max_tokens: z.number().int().positive().max(8192),
});

const DEFAULT_COLLECTION_ID = "00000000-0000-0000-0000-000000000001";

const RAG_ACCEPT = ".txt,.md,.csv,.json,image/png,image/jpeg,image/webp,image/gif";

function RAGConfigSection({
  config,
  applyConfig,
  parseNumber,
  graphId,
  mode,
}: {
  config: Record<string, unknown>;
  applyConfig: (c: Record<string, unknown>) => void;
  parseNumber: (v: string) => number;
  graphId?: string;
  mode: "simple" | "advanced";
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error">("idle");
  const [chunksIngested, setChunksIngested] = useState<number | null>(null);
  const [fileResults, setFileResults] = useState<Array<{ filename: string; chunks_ingested: number; skipped?: string }>>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const collectionId = String(config.collection_id ?? "").trim() || DEFAULT_COLLECTION_ID;

  async function processFiles(fileList: FileList | null) {
    if (!fileList?.length || !graphId) return;
    const files = Array.from(fileList);
    setUploading(true);
    setUploadStatus("idle");
    setChunksIngested(null);
    setFileResults([]);
    try {
      const res = await ingestRagDocuments(graphId, files, collectionId);
      setUploadStatus("success");
      setChunksIngested(res.chunks_ingested ?? 0);
      if (res.files?.length) setFileResults(res.files);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setUploadStatus("error");
    } finally {
      setUploading(false);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    processFiles(e.target.files);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    processFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="rag-topk">{mode === "simple" ? "Documents to read" : "Top K"}</Label>
        <Input
          id="rag-topk"
          type="number"
          defaultValue={String(config.top_k ?? 5)}
          onBlur={(e) =>
            applyConfig({
              ...config,
              top_k: parseNumber(e.target.value),
              min_score: Number(config.min_score ?? 0.65),
            })
          }
        />
        <p className="text-xs text-zinc-500">
          {mode === "simple"
            ? "How many matching documents should be included."
            : "Number of nearest neighbors to retrieve."}
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="rag-minscore">
          {mode === "simple" ? "Match confidence" : "Min Score"}
        </Label>
        <Input
          id="rag-minscore"
          type="number"
          step="0.01"
          defaultValue={String(config.min_score ?? 0.65)}
          onBlur={(e) =>
            applyConfig({
              ...config,
              top_k: Number(config.top_k ?? 5),
              min_score: parseNumber(e.target.value),
            })
          }
        />
        <p className="text-xs text-zinc-500">
          {mode === "simple"
            ? "Higher confidence means stricter matching."
            : "Similarity threshold between 0 and 1."}
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="rag-collection">Collection ID</Label>
        <Input
          id="rag-collection"
          placeholder={DEFAULT_COLLECTION_ID}
          defaultValue={String(config.collection_id ?? "")}
          onBlur={(e) =>
            applyConfig({
              ...config,
              top_k: Number(config.top_k ?? 5),
              min_score: Number(config.min_score ?? 0.65),
              collection_id: e.target.value.trim() || undefined,
            })
          }
        />
        <p className="text-xs text-zinc-500">Used for uploads and retrieval. Leave default if unsure.</p>
      </div>
      {(!graphId || graphId === "new") && (
        <p className="rounded-md border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-400">
          Save the workflow first (click Run once to auto-save), then you can add documents here.
        </p>
      )}
      {graphId && graphId !== "new" && (
        <div className="space-y-1">
          <Label>Add documents or images</Label>
          <p className="text-xs text-zinc-500">
            When you run the workflow, it will search these to answer questions. Add files so the AI has something to read.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={RAG_ACCEPT}
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />
          <div
            role="button"
            tabIndex={0}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            className={`cursor-pointer rounded-md border-2 border-dashed px-3 py-4 text-center text-sm transition-colors ${
              dragOver
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-zinc-600 bg-zinc-900/50 hover:border-zinc-500 hover:bg-zinc-800/50"
            } ${uploading ? "pointer-events-none opacity-70" : ""}`}
          >
            {uploading ? (
              "Uploading…"
            ) : (
              <>
                Drop files here or click to add. Supports documents and images.
                <br />
                <span className="text-xs text-zinc-500">.txt, .md, .csv, .json, or images</span>
              </>
            )}
          </div>
          {fileResults.length > 0 && (
            <ul className="max-h-24 space-y-0.5 overflow-y-auto text-xs text-zinc-400">
              {fileResults.map((r, i) => (
                <li key={i}>
                  {r.filename}: {r.chunks_ingested} chunk{r.chunks_ingested !== 1 ? "s" : ""}
                  {r.skipped ? ` (${r.skipped})` : ""}
                </li>
              ))}
            </ul>
          )}
          {chunksIngested != null && chunksIngested > 0 && (
            <p className="text-xs text-emerald-500">
              Total: {chunksIngested} chunk{chunksIngested !== 1 ? "s" : ""} ingested.
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            className="h-9 w-full border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Uploading…" : "Browse for files"}
          </Button>
          {uploadStatus === "success" && chunksIngested != null && chunksIngested > 0 && (
            <p className="text-xs text-emerald-400">Run the workflow to retrieve.</p>
          )}
          {uploadStatus === "error" && (
            <p className="text-xs text-red-400">Upload failed. Check API is running and you’re signed in.</p>
          )}
        </div>
      )}
    </div>
  );
}

const ragSchema = z.object({
  top_k: z.number().int().positive().max(20),
  min_score: z.number().min(0).max(1),
  collection_id: z.string().optional(),
});

const branchSchema = z.object({
  expr: z.string().min(1),
  target: z.string(), // Can be empty until user selects a node
});

const mcpSchema = z
  .object({
    provider: z.string().optional(),
    action: z.string().optional(),
    server_url: z.string().url().optional(),
    tool_name: z.string().optional(),
    params: z.record(z.unknown()).optional(),
    test_mode: z.boolean().optional(),
  })
  .refine(
    (value) =>
      (value.provider && value.action) ||
      (value.server_url && value.tool_name),
    {
      message:
        "Configure either an integration (provider + action) or an MCP server (server URL + tool name).",
    },
  );

const actionSchema = z.object({
  provider: z.string().min(1),
  action: z.string().min(1),
  params: z.record(z.unknown()).optional(),
  test_mode: z.boolean().optional(),
});

const httpSchema = z.object({
  method: z.string().min(1),
  url: z.string(),
  headers: z.record(z.unknown()).optional(),
  body: z.string().optional(),
  body_type: z.enum(["none", "json", "raw"]).optional(),
});

const simpleLlmSchema = z.object({
  model: z.string().min(1),
  prompt: z.string().optional(),
  system_prompt: z.string().optional(),
  temperature: z.number().min(0).max(1),
  max_tokens: z.number().int().positive().max(8192),
});

type SelectedNode = {
  id: string;
  type: ForgeNodeType;
  data: ForgeNodeData;
} | null;

interface NodeConfigPanelProps {
  selectedNode: SelectedNode;
  onUpdateNodeConfig: (nodeId: string, partialConfig: Record<string, unknown>) => void;
  /** All nodes in the graph (for conditional branch target picker) */
  allNodes?: Array<{ id: string; data?: { label?: string } }>;
  /** Graph ID (for RAG document upload) */
  graphId?: string;
}

function HttpRequestConfig({
  config,
  applyConfig,
}: {
  config: Record<string, unknown>;
  applyConfig: (c: Record<string, unknown>) => void;
}) {
  const headersObj = (config.headers as Record<string, string>) ?? {};
  const headerRows = Object.entries(headersObj).map(([k, v]) => ({ key: k, value: v }));
  const bodyType = (config.body_type as "none" | "json" | "raw") ?? (config.body ? "json" : "none");

  const updateHeaders = (rows: Array<{ key: string; value: string }>) => {
    const obj: Record<string, string> = {};
    for (const r of rows) {
      if (r.key.trim()) obj[r.key.trim()] = r.value ?? "";
    }
    applyConfig({ ...config, headers: obj });
  };

  const addHeader = () => updateHeaders([...headerRows, { key: "", value: "" }]);
  const removeHeader = (idx: number) => updateHeaders(headerRows.filter((_, i) => i !== idx));
  const updateHeader = (idx: number, patch: Partial<{ key: string; value: string }>) => {
    const next = [...headerRows];
    next[idx] = { ...(next[idx] ?? { key: "", value: "" }), ...patch };
    updateHeaders(next);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="http-method">Method</Label>
        <select
          id="http-method"
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          value={String(config.method ?? "GET")}
          onChange={(e) => applyConfig({ ...config, method: e.target.value })}
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="http-url">URL</Label>
        <Input
          id="http-url"
          placeholder="https://api.example.com/endpoint"
          defaultValue={String(config.url ?? "")}
          onBlur={(e) => applyConfig({ ...config, url: e.target.value })}
        />
        <p className="text-xs text-zinc-500">Use {"{{input.url}}"} for dynamic values</p>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label>Headers</Label>
          <button
            type="button"
            onClick={addHeader}
            className="rounded bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700"
          >
            + Add
          </button>
        </div>
        {headerRows.length === 0 ? (
          <p className="text-xs text-zinc-500">No headers. Add Content-Type, Authorization, etc.</p>
        ) : (
          <div className="space-y-2">
            {headerRows.map((h, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  placeholder="Key"
                  value={h.key}
                  onChange={(e) => updateHeader(idx, { key: e.target.value })}
                  onBlur={(e) => updateHeader(idx, { key: e.target.value })}
                  className="h-8 flex-1 text-xs"
                />
                <Input
                  placeholder="Value"
                  value={h.value}
                  onChange={(e) => updateHeader(idx, { value: e.target.value })}
                  onBlur={(e) => updateHeader(idx, { value: e.target.value })}
                  className="h-8 flex-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => removeHeader(idx)}
                  className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
                  aria-label="Remove header"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <Label>Body</Label>
        <div className="flex gap-2">
          {(["none", "json", "raw"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() =>
                applyConfig({
                  ...config,
                  body_type: t,
                  body: t === "none" ? "" : String(config.body ?? ""),
                })
              }
              className={`rounded px-2 py-1 text-[11px] ${
                bodyType === t ? "bg-zinc-200 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {t === "none" ? "None" : t === "json" ? "JSON" : "Raw"}
            </button>
          ))}
        </div>
        {(bodyType === "json" || bodyType === "raw") && (
          <textarea
            className="mt-2 min-h-[80px] w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 font-mono"
            placeholder={bodyType === "json" ? '{"key": "value"}' : "Plain text body"}
            rows={4}
            defaultValue={String(config.body ?? "")}
            onBlur={(e) => applyConfig({ ...config, body: e.target.value })}
          />
        )}
      </div>
    </div>
  );
}

function SetNodeConfig({
  config,
  applyConfig,
  mode,
}: {
  config: Record<string, unknown>;
  applyConfig: (c: Record<string, unknown>) => void;
  mode: "simple" | "advanced";
}) {
  const fields = (Array.isArray(config.fields) ? config.fields : []) as Array<{
    key?: string;
    value?: string;
    action?: string;
    rename_to?: string;
  }>;

  const updateFields = (next: typeof fields) => {
    applyConfig({ ...config, fields: next });
  };

  const addField = () => {
    updateFields([...fields, { action: "set", key: "", value: "" }]);
  };

  const removeField = (idx: number) => {
    updateFields(fields.filter((_, i) => i !== idx));
  };

  const updateField = (idx: number, patch: Partial<(typeof fields)[0]>) => {
    const next = [...fields];
    next[idx] = { ...(next[idx] ?? {}), ...patch };
    updateFields(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Fields</Label>
        <button
          type="button"
          onClick={addField}
          className="rounded bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700"
        >
          + Add field
        </button>
      </div>
      {fields.length === 0 ? (
        <p className="text-xs text-zinc-500">
          No fields yet. Add a field to set, remove, or rename data.
        </p>
      ) : (
        <div className="space-y-2">
          {fields.map((f, idx) => (
            <div
              key={idx}
              className="rounded-md border border-zinc-800 bg-zinc-900 p-2 space-y-2"
            >
              <div className="flex items-center justify-between gap-1">
                <select
                  className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-200"
                  value={String(f.action ?? "set")}
                  onChange={(e) => updateField(idx, { action: e.target.value })}
                >
                  <option value="set">Set</option>
                  <option value="remove">Remove</option>
                  <option value="rename">Rename</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeField(idx)}
                  className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
                  aria-label="Remove field"
                >
                  ×
                </button>
              </div>
              <div className="space-y-1">
                <Input
                  placeholder="Key"
                  value={String(f.key ?? "")}
                  onChange={(e) => updateField(idx, { key: e.target.value })}
                  onBlur={(e) => updateField(idx, { key: e.target.value })}
                  className="h-8 text-xs"
                />
                {(f.action ?? "set") === "set" && (
                  <Input
                    placeholder="Value (use {{input.x}} for expressions)"
                    value={String(f.value ?? "")}
                    onChange={(e) => updateField(idx, { value: e.target.value })}
                    onBlur={(e) => updateField(idx, { value: e.target.value })}
                    className="h-8 text-xs"
                  />
                )}
                {(f.action ?? "set") === "rename" && (
                  <Input
                    placeholder="Rename to"
                    value={String(f.rename_to ?? "")}
                    onChange={(e) => updateField(idx, { rename_to: e.target.value })}
                    onBlur={(e) => updateField(idx, { rename_to: e.target.value })}
                    className="h-8 text-xs"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {mode === "advanced" && (
        <p className="text-[11px] text-zinc-500">
          Set: add/overwrite. Remove: delete key. Rename: change key name.
        </p>
      )}
    </div>
  );
}

function parseNumber(value: string): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    throw new Error("JSON must be an object");
  } catch {
    throw new Error("Payload JSON must be a valid JSON object.");
  }
}

export function NodeConfigPanel({
  selectedNode,
  onUpdateNodeConfig,
  allNodes = [],
  graphId,
}: NodeConfigPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"simple" | "advanced">("simple");

  if (!selectedNode) {
    return (
      <aside className="w-80 border-l border-zinc-800 bg-zinc-950/90 p-4 text-sm text-zinc-400">
        Select a node to edit its configuration.
      </aside>
    );
  }

  const config = selectedNode.data.config ?? {};
  const provider = String((config as Record<string, unknown>).provider ?? "");
  const action = String((config as Record<string, unknown>).action ?? "");
  const serverUrl = String((config as Record<string, unknown>).server_url ?? "");
  const toolName = String((config as Record<string, unknown>).tool_name ?? "");
  const params =
    (typeof (config as Record<string, unknown>).params === "object" &&
    (config as Record<string, unknown>).params
      ? ((config as Record<string, unknown>).params as Record<string, unknown>)
      : {}) || {};
  const isGmail = provider === "gmail";

  const applyConfig = (nextConfig: Record<string, unknown>) => {
    setError(null);
    try {
      if (selectedNode.type === "llm_caller") llmSchema.parse(nextConfig);
      if (selectedNode.type === "simple_llm") simpleLlmSchema.parse(nextConfig);
      if (selectedNode.type === "rag_retriever") ragSchema.parse(nextConfig);
      if (selectedNode.type === "conditional_branch") branchSchema.parse(nextConfig);
      if (selectedNode.type === "mcp_tool") mcpSchema.parse(nextConfig);
      if (selectedNode.type === "action") actionSchema.parse(nextConfig);
      if (selectedNode.type === "http_request") httpSchema.parse(nextConfig);
      if (selectedNode.type === "research") {}
      if (selectedNode.type === "web_scrape") {}
      if (selectedNode.type === "vision_extract") {}
      if (selectedNode.type === "sql_query") {}
      if (selectedNode.type === "loop") {}
      if (selectedNode.type === "template_render") {}
      if (selectedNode.type === "pdf_report") {}
      if (selectedNode.type === "wait_callback") {}
      if (selectedNode.type === "error_handler") {}
      if (selectedNode.type === "set_node") {} // No strict schema for set_node
      if (selectedNode.type === "delay") {} // No strict schema for delay
      if (selectedNode.type === "json_parse") {} // No strict schema for json_parse
      if (selectedNode.type === "json_stringify") {} // No strict schema for json_stringify
      if (selectedNode.type === "merge") {} // No strict schema for merge
      if (selectedNode.type === "filter") {} // No strict schema for filter
      if (selectedNode.type === "schedule_trigger") {}
      if (selectedNode.type === "form_submission_trigger") {}
      if (selectedNode.type === "app_event_trigger") {}
      if (selectedNode.type === "ai_agent") {}
      onUpdateNodeConfig(selectedNode.id, nextConfig);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0]?.message ?? "Invalid configuration");
        return;
      }
      setError("Invalid configuration");
    }
  };

  return (
    <aside className="w-80 border-l border-zinc-800 bg-zinc-950/90 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-200">{selectedNode.data.label}</h3>
        <div className="rounded bg-zinc-900 p-1 text-[11px]">
          <button
            type="button"
            onClick={() => setMode("simple")}
            className={`rounded px-2 py-1 ${
              mode === "simple" ? "bg-zinc-200 text-zinc-900" : "text-zinc-400"
            }`}
          >
            Simple
          </button>
          <button
            type="button"
            onClick={() => setMode("advanced")}
            className={`rounded px-2 py-1 ${
              mode === "advanced" ? "bg-zinc-200 text-zinc-900" : "text-zinc-400"
            }`}
          >
            Advanced
          </button>
        </div>
      </div>
      {selectedNode.type === "llm_caller" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="llm-model">Model</Label>
            <select
              id="llm-model"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              value={String(config.model ?? "gpt-4o-mini")}
              onChange={(e) =>
                applyConfig({
                  ...config,
                  model: e.target.value,
                  temperature: Number(config.temperature ?? 0.7),
                  max_tokens: Number(config.max_tokens ?? 1024),
                })
              }
            >
              {LLM_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            {mode === "simple" ? (
              <p className="text-xs text-zinc-500">Pick a model for text generation.</p>
            ) : (
              <p className="text-xs text-zinc-500">Provider model id used by execution backend.</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="llm-system">System prompt</Label>
            <textarea
              id="llm-system"
              rows={4}
              className="min-h-[80px] w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              defaultValue={String(config.system_prompt ?? "")}
              onBlur={(e) =>
                applyConfig({
                  ...config,
                  model: String(config.model ?? "gpt-4o-mini"),
                  system_prompt: e.target.value,
                  temperature: Number(config.temperature ?? 0.7),
                  max_tokens: Number(config.max_tokens ?? 1024),
                })
              }
            />
            <div className="flex flex-wrap gap-1">
              {["{{input.query}}", "{{input.prompt}}", "{{input.text}}"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    const ta = document.getElementById("llm-system") as HTMLTextAreaElement;
                    if (ta) {
                      const start = ta.selectionStart;
                      const end = ta.selectionEnd;
                      const before = ta.value.slice(0, start);
                      const after = ta.value.slice(end);
                      const next = before + v + after;
                      ta.value = next;
                      ta.focus();
                      ta.setSelectionRange(start + v.length, start + v.length);
                      applyConfig({
                        ...config,
                        system_prompt: next,
                        model: String(config.model ?? "gpt-4o-mini"),
                        temperature: Number(config.temperature ?? 0.7),
                        max_tokens: Number(config.max_tokens ?? 1024),
                      });
                    }
                  }}
                  className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-300 hover:bg-zinc-700"
                >
                  {v}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500">Optional. Use variables from previous steps.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="llm-temp">{mode === "simple" ? "Creativity" : "Temperature"}</Label>
            <Input
              id="llm-temp"
              type="number"
              step="0.1"
              defaultValue={String(config.temperature ?? 0.7)}
              onBlur={(e) =>
                applyConfig({
                  ...config,
                  model: String(config.model ?? "gpt-4o-mini"),
                  temperature: parseNumber(e.target.value),
                  max_tokens: Number(config.max_tokens ?? 1024),
                })
              }
            />
            <p className="text-xs text-zinc-500">
              {mode === "simple"
                ? "Lower = consistent output, higher = more creative output."
                : "Sampling temperature between 0 and 1."}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="llm-max">{mode === "simple" ? "Response length" : "Max Tokens"}</Label>
            <Input
              id="llm-max"
              type="number"
              defaultValue={String(config.max_tokens ?? 1024)}
              onBlur={(e) =>
                applyConfig({
                  ...config,
                  model: String(config.model ?? "gpt-4o-mini"),
                  temperature: Number(config.temperature ?? 0.7),
                  max_tokens: parseNumber(e.target.value),
                })
              }
            />
            <p className="text-xs text-zinc-500">
              {mode === "simple"
                ? "Controls how long the generated response can be."
                : "Upper bound for output tokens."}
            </p>
          </div>
          {mode === "advanced" && (
            <div className="space-y-2 border-t border-zinc-800 pt-3">
              <p className="text-xs font-medium text-zinc-400">Prompt chain</p>
              <p className="text-[11px] text-zinc-500">
                Optional. Group LLM steps and pass named fields from merged upstream output into
                this call (e.g. <code className="text-zinc-400">output</code>,{" "}
                <code className="text-zinc-400">documents</code>).
              </p>
              <div className="space-y-1">
                <Label htmlFor="chain-id">Chain id</Label>
                <Input
                  id="chain-id"
                  placeholder="e.g. support_triage"
                  defaultValue={String(
                    (config.prompt_chain as { id?: string } | undefined)?.id ?? "",
                  )}
                  onBlur={(e) => {
                    const pc = (config.prompt_chain as Record<string, unknown> | undefined) ?? {};
                    applyConfig({
                      ...config,
                      prompt_chain: {
                        ...pc,
                        id: e.target.value.trim() || undefined,
                        step_index: Number(pc.step_index ?? 0),
                        carry_keys: Array.isArray(pc.carry_keys) ? pc.carry_keys : [],
                      },
                    });
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="chain-step">Step index</Label>
                <Input
                  id="chain-step"
                  type="number"
                  defaultValue={String(
                    (config.prompt_chain as { step_index?: number } | undefined)?.step_index ?? 0,
                  )}
                  onBlur={(e) => {
                    const pc = (config.prompt_chain as Record<string, unknown> | undefined) ?? {};
                    applyConfig({
                      ...config,
                      prompt_chain: {
                        ...pc,
                        step_index: parseNumber(e.target.value),
                        carry_keys: Array.isArray(pc.carry_keys) ? pc.carry_keys : [],
                      },
                    });
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="chain-keys">Carry keys (comma-separated)</Label>
                <Input
                  id="chain-keys"
                  placeholder="output, documents"
                  defaultValue={
                    Array.isArray((config.prompt_chain as { carry_keys?: string[] })?.carry_keys)
                      ? (config.prompt_chain as { carry_keys: string[] }).carry_keys.join(", ")
                      : ""
                  }
                  onBlur={(e) => {
                    const keys = e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    const pc = (config.prompt_chain as Record<string, unknown> | undefined) ?? {};
                    applyConfig({
                      ...config,
                      prompt_chain: {
                        ...pc,
                        carry_keys: keys,
                      },
                    });
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {selectedNode.type === "rag_retriever" && (
        <RAGConfigSection
          config={config}
          applyConfig={applyConfig}
          parseNumber={parseNumber}
          graphId={graphId}
          mode={mode}
        />
      )}

      {selectedNode.type === "conditional_branch" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="branch-expr">
              {mode === "simple" ? "Rule (if this is true)" : "Expression"}
            </Label>
            <Input
              id="branch-expr"
              defaultValue={String(config.expr ?? "value > 0")}
              onBlur={(e) =>
                applyConfig({
                  ...config,
                  expr: e.target.value,
                  target: String(config.target ?? ""),
                })
              }
            />
            <p className="text-xs text-zinc-500">
              Example: <code>value &gt; 0</code> routes to the target branch.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="branch-target">Route to node</Label>
            {allNodes.length > 0 ? (
              <select
                id="branch-target"
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                value={String(config.target ?? "")}
                onChange={(e) =>
                  applyConfig({
                    ...config,
                    expr: String(config.expr ?? "value > 0"),
                    target: e.target.value,
                  })
                }
              >
                <option value="">— Select target node —</option>
                {allNodes
                  .filter((n) => n.id !== selectedNode.id)
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {(n.data?.label as string) || n.id}
                    </option>
                  ))}
              </select>
            ) : (
              <Input
                id="branch-target"
                placeholder="Node ID"
                defaultValue={String(config.target ?? "")}
                onBlur={(e) =>
                  applyConfig({
                    ...config,
                    expr: String(config.expr ?? "value > 0"),
                    target: e.target.value,
                  })
                }
              />
            )}
            <p className="text-xs text-zinc-500">
              When the rule is true, execution continues to this node.
            </p>
          </div>
        </div>
      )}

      {selectedNode.type === "action" && (
        <div className="space-y-3">
          <p className="text-[11px] text-zinc-500">
            Built-in integrations: Gmail, Slack, Telegram, Google Search, Sheets, Notion.
          </p>
          {isGmail && (
            <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-300">
              <p className="mb-2 font-semibold text-zinc-100">
                Gmail {action.includes("search") ? "Fetch Emails" : "Send Email"}
              </p>
              {action.includes("search") && (
                <div className="space-y-1">
                  <Label htmlFor="action-gmail-query">Which messages?</Label>
                  <Input
                    id="action-gmail-query"
                    defaultValue={String((params.query as string | undefined) ?? "newer_than:3d in:inbox")}
                    onBlur={(e) =>
                      applyConfig({
                        ...config,
                        provider: "gmail",
                        action: action || "search_messages",
                        params: { ...params, query: e.target.value },
                        test_mode: Boolean(config.test_mode ?? true),
                      })
                    }
                  />
                </div>
              )}
              {action.includes("send") && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={!Boolean(config.test_mode ?? true)}
                      onChange={(e) =>
                        applyConfig({
                          ...config,
                          provider: "gmail",
                          action: "send_email",
                          params,
                          test_mode: !e.target.checked,
                        })
                      }
                    />
                    <span>Send real email</span>
                  </label>
                  <div className="space-y-1">
                    <Label htmlFor="action-gmail-to">To</Label>
                    <Input
                      id="action-gmail-to"
                      defaultValue={String((params.to as string | undefined) ?? "me@example.com")}
                      onBlur={(e) =>
                        applyConfig({
                          ...config,
                          provider: "gmail",
                          action: action || "send_email",
                          params: { ...params, to: e.target.value },
                          test_mode: Boolean(config.test_mode ?? true),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="action-gmail-subject">Subject</Label>
                    <Input
                      id="action-gmail-subject"
                      defaultValue={String((params.subject as string | undefined) ?? "")}
                      onBlur={(e) =>
                        applyConfig({
                          ...config,
                          provider: "gmail",
                          action: action || "send_email",
                          params: { ...params, subject: e.target.value },
                          test_mode: Boolean(config.test_mode ?? true),
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="action-provider">Provider</Label>
            <select
              id="action-provider"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              value={provider || "gmail"}
              onChange={(e) => {
                const newProvider = e.target.value;
                const actions = getActionsForProvider(newProvider);
                const firstAction = actions[0]?.value ?? "post_message";
                applyConfig({
                  ...config,
                  provider: newProvider,
                  action: newProvider === provider ? action : firstAction,
                  params,
                  test_mode: Boolean(config.test_mode ?? true),
                });
              }}
            >
              {INTEGRATION_PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="action-action">Action</Label>
            <select
              id="action-action"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              value={action || (getActionsForProvider(provider)[0]?.value ?? "post_message")}
              onChange={(e) =>
                applyConfig({
                  ...config,
                  provider: provider || "gmail",
                  action: e.target.value,
                  params,
                  test_mode: Boolean(config.test_mode ?? true),
                })
              }
            >
              {getActionsForProvider(provider).map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="action-params-json">Payload JSON (advanced)</Label>
            <Input
              id="action-params-json"
              defaultValue={JSON.stringify(params ?? {})}
              onBlur={(e) =>
                applyConfig({
                  ...config,
                  provider: provider || undefined,
                  action: action || undefined,
                  params: parseJsonObject(e.target.value),
                  test_mode: Boolean(config.test_mode ?? true),
                })
              }
              className="h-8 w-full font-mono text-[11px]"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              defaultChecked={Boolean(config.test_mode ?? true)}
              onChange={(e) =>
                applyConfig({
                  ...config,
                  provider: provider || undefined,
                  action: action || undefined,
                  params,
                  test_mode: e.target.checked,
                })
              }
            />
            Test mode (mock when keys not set)
          </label>
        </div>
      )}

      {selectedNode.type === "mcp_tool" && (
        <div className="space-y-3">
          <p className="text-[11px] text-zinc-500">
            Use tools from the{" "}
            <a
              href="https://registry.modelcontextprotocol.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline"
            >
              Official MCP Registry
            </a>
            . For Gmail, Slack, Telegram, etc. use the <strong>Action</strong> node.
          </p>
          {isGmail && (
            <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-300">
              <p className="mb-2 font-semibold text-zinc-100">
                Gmail {action.includes("search") ? "Fetch Emails" : "Send Email"}
              </p>
              {action.includes("search") && (
                <div className="space-y-1">
                  <Label htmlFor="gmail-query">Which messages?</Label>
                  <Input
                    id="gmail-query"
                    defaultValue={String((params.query as string | undefined) ?? "newer_than:3d in:inbox")}
                    onBlur={(e) =>
                      applyConfig({
                        ...config,
                        provider: "gmail",
                        action: action || "search_messages",
                        params: { ...params, query: e.target.value },
                        test_mode: Boolean(config.test_mode ?? true),
                      })
                    }
                  />
                  <p className="text-[11px] text-zinc-500">
                    Example: newer_than:3d in:inbox
                  </p>
                </div>
              )}
              {action.includes("send") && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={!Boolean(config.test_mode ?? true)}
                      onChange={(e) =>
                        applyConfig({
                          ...config,
                          provider: "gmail",
                          action: "send_email",
                          params,
                          test_mode: !e.target.checked,
                        })
                      }
                    />
                    <span>Send real email</span>
                  </label>
                  <p className="text-[11px] text-zinc-500">
                    Check to send real email. Add Gmail OAuth token in Run settings.
                  </p>
                  <div className="space-y-1">
                    <Label htmlFor="gmail-to">To</Label>
                    <Input
                      id="gmail-to"
                      defaultValue={String((params.to as string | undefined) ?? "me@example.com")}
                      onBlur={(e) =>
                        applyConfig({
                          ...config,
                          provider: "gmail",
                          action: action || "send_email",
                          params: { ...params, to: e.target.value },
                          test_mode: Boolean(config.test_mode ?? true),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="gmail-subject">Subject</Label>
                    <Input
                      id="gmail-subject"
                      defaultValue={String((params.subject as string | undefined) ?? "")}
                      onBlur={(e) =>
                        applyConfig({
                          ...config,
                          provider: "gmail",
                          action: action || "send_email",
                          params: { ...params, subject: e.target.value },
                          test_mode: Boolean(config.test_mode ?? true),
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-300">
            <p className="mb-2 font-semibold text-zinc-100">Connection type</p>
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 rounded px-2 py-1 text-[11px] ${
                  provider
                    ? "bg-zinc-200 text-zinc-900"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
                onClick={() => {
                  applyConfig({
                    ...config,
                    server_url: undefined,
                    tool_name: undefined,
                    provider: provider || "slack",
                    action: action || "post_message",
                    params,
                    test_mode: Boolean(config.test_mode ?? true),
                  });
                }}
              >
                Built-in (Gmail, Slack…)
              </button>
              <button
                type="button"
                className={`flex-1 rounded px-2 py-1 text-[11px] ${
                  !provider && serverUrl
                    ? "bg-zinc-200 text-zinc-900"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
                onClick={() => {
                  applyConfig({
                    ...config,
                    provider: undefined,
                    action: undefined,
                    server_url: serverUrl || "http://localhost:8001/mcp",
                    tool_name: toolName || "",
                    params,
                    test_mode: Boolean(config.test_mode ?? true),
                  });
                }}
              >
                Custom MCP server
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500">
              Built-in uses pre-configured integrations. Custom connects to any MCP server URL.
            </p>
          </div>

          {/* Integration mode */}
          {provider && (
            <>
              <div className="space-y-1">
                <Label htmlFor="mcp-provider">Integration Provider</Label>
                <select
                  id="mcp-provider"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                  value={provider || "gmail"}
                  onChange={(e) => {
                    const newProvider = e.target.value;
                    const actions = getActionsForProvider(newProvider);
                    const firstAction = actions[0]?.value ?? "post_message";
                    applyConfig({
                      ...config,
                      provider: newProvider,
                      action: newProvider === provider ? action : firstAction,
                      params,
                      test_mode: Boolean(config.test_mode ?? true),
                    });
                  }}
                >
                  {INTEGRATION_PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="mcp-action">Action</Label>
                <select
                  id="mcp-action"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                  value={action || (getActionsForProvider(provider)[0]?.value ?? "post_message")}
                  onChange={(e) =>
                    applyConfig({
                      ...config,
                      provider: provider || "gmail",
                      action: e.target.value,
                      params,
                      test_mode: Boolean(config.test_mode ?? true),
                    })
                  }
                >
                  {getActionsForProvider(provider).map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* MCP server mode */}
          {!provider && (
            <>
              <div className="space-y-1">
                <Label htmlFor="mcp-server">MCP server URL</Label>
                <Input
                  id="mcp-server"
                  placeholder="https://your-mcp-server.com/mcp"
                  defaultValue={serverUrl || ""}
                  onBlur={(e) =>
                    applyConfig({
                      ...config,
                      server_url: e.target.value || undefined,
                      tool_name: toolName || undefined,
                      test_mode: Boolean(config.test_mode ?? true),
                    })
                  }
                />
                <div className="flex flex-wrap gap-1">
                  {["http://localhost:8001/mcp", "http://localhost:4000/mcp"].map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() =>
                        applyConfig({
                          ...config,
                          server_url: url,
                          tool_name: toolName || undefined,
                          test_mode: Boolean(config.test_mode ?? true),
                        })
                      }
                      className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-700"
                    >
                      {url.includes("8001") ? "Local dev" : "LiteLLM"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-zinc-500">
                  Enter your MCP server URL or pick a preset.
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="mcp-tool-name">Tool name</Label>
                <Input
                  id="mcp-tool-name"
                  placeholder="e.g. search_web, read_file"
                  defaultValue={toolName || ""}
                  onBlur={(e) =>
                    applyConfig({
                      ...config,
                      server_url: serverUrl || undefined,
                      tool_name: e.target.value.trim() || undefined,
                      params,
                      test_mode: Boolean(config.test_mode ?? true),
                    })
                  }
                />
                <p className="text-xs text-zinc-500">
                  Enter the MCP tool identifier. Tool lists from servers can be added later.
                </p>
              </div>
            </>
          )}

          <div className="space-y-1">
            <Label htmlFor="mcp-params-json">Payload JSON (advanced)</Label>
            <Input
              id="mcp-params-json"
              defaultValue={JSON.stringify(params ?? {})}
              onBlur={(e) =>
                applyConfig({
                  ...config,
                  provider: provider || undefined,
                  action: action || undefined,
                  server_url: serverUrl || undefined,
                  tool_name: toolName || undefined,
                  params: parseJsonObject(e.target.value),
                  test_mode: Boolean(config.test_mode ?? true),
                })
              }
            />
          </div>
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                defaultChecked={Boolean(config.test_mode ?? true)}
                onChange={(e) =>
                  applyConfig({
                    ...config,
                    provider: provider || undefined,
                    action: action || undefined,
                    server_url: serverUrl || undefined,
                    tool_name: toolName || undefined,
                    params,
                    test_mode: e.target.checked,
                  })
                }
              />
              Test mode
            </label>
            <p className="text-[11px] text-zinc-500">
              When on, uses safe mocked execution when API keys or tokens are not configured.
            </p>
          </div>
        </div>
      )}

      {(selectedNode.type === "manual_trigger" || selectedNode.type === "webhook_trigger") && (
        <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-400">
          {selectedNode.type === "manual_trigger"
            ? "Manual trigger starts the workflow when you click Run or call the API."
            : "Webhook trigger starts the workflow when POST /webhooks/workflow/{graph_id} is called."}
        </div>
      )}

      {selectedNode.type === "schedule_trigger" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Presets</Label>
            <div className="flex flex-wrap gap-1">
              {[
                { label: "Every hour", schedule_type: "interval", interval_value: 1, interval_unit: "hours" },
                { label: "Every 15 min", schedule_type: "interval", interval_value: 15, interval_unit: "minutes" },
                { label: "Daily 9am", schedule_type: "cron", cron_expression: "0 9 * * *" },
                { label: "Weekly Mon", schedule_type: "cron", cron_expression: "0 9 * * 1" },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    applyConfig({
                      ...config,
                      schedule_type: preset.schedule_type,
                      interval_value: "interval_value" in preset ? preset.interval_value : 1,
                      interval_unit: "interval_unit" in preset ? preset.interval_unit : "hours",
                      cron_expression: "cron_expression" in preset ? preset.cron_expression : "",
                    })
                  }
                  className="rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-700"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="schedule-type">Schedule type</Label>
            <select
              id="schedule-type"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              value={String(config.schedule_type ?? "interval")}
              onChange={(e) =>
                applyConfig({
                  ...config,
                  schedule_type: e.target.value,
                  interval_value: Number(config.interval_value ?? 1),
                  interval_unit: String(config.interval_unit ?? "hours"),
                  cron_expression: String(config.cron_expression ?? ""),
                })
              }
            >
              <option value="interval">Interval</option>
              <option value="cron">Cron</option>
            </select>
          </div>
          {(config.schedule_type ?? "interval") !== "cron" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="schedule-interval-value">Every</Label>
                <div className="flex gap-2">
                  <Input
                    id="schedule-interval-value"
                    type="number"
                    min={1}
                    defaultValue={String(config.interval_value ?? 1)}
                    onBlur={(e) =>
                      applyConfig({
                        ...config,
                        interval_value: parseNumber(e.target.value) || 1,
                        interval_unit: String(config.interval_unit ?? "hours"),
                      })
                    }
                  />
                  <select
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                    defaultValue={String(config.interval_unit ?? "hours")}
                    onChange={(e) =>
                      applyConfig({
                        ...config,
                        interval_value: Number(config.interval_value ?? 1),
                        interval_unit: e.target.value,
                      })
                    }
                  >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              </div>
            </>
          )}
          {(config.schedule_type ?? "interval") === "cron" && (
            <div className="space-y-1">
              <Label htmlFor="schedule-cron">Cron expression</Label>
              <Input
                id="schedule-cron"
                defaultValue={String(config.cron_expression ?? "0 * * * *")}
                placeholder="0 * * * * (hourly)"
                onBlur={(e) =>
                  applyConfig({
                    ...config,
                    cron_expression: e.target.value,
                  })
                }
              />
              <p className="text-xs text-zinc-500">e.g. 0 * * * * for every hour</p>
            </div>
          )}
        </div>
      )}

      {selectedNode.type === "form_submission_trigger" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="form-schema">Form schema (JSON)</Label>
            <textarea
              id="form-schema"
              className="min-h-[120px] w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              defaultValue={
                typeof config.form_schema === "object"
                  ? JSON.stringify(config.form_schema, null, 2)
                  : String(config.form_schema ?? "{}")
              }
              onBlur={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value || "{}") as Record<string, unknown>;
                  applyConfig({ ...config, form_schema: parsed });
                } catch {
                  // keep previous on invalid JSON
                }
              }}
            />
            <p className="text-xs text-zinc-500">JSON Schema for form fields.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="form-webhook-path">Webhook path (optional)</Label>
            <Input
              id="form-webhook-path"
              defaultValue={String(config.webhook_path ?? "")}
              placeholder="/form/abc123"
              onBlur={(e) =>
                applyConfig({
                  ...config,
                  webhook_path: e.target.value.trim() || undefined,
                })
              }
            />
          </div>
        </div>
      )}

      {selectedNode.type === "app_event_trigger" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="app-event-app">App</Label>
            <select
              id="app-event-app"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              defaultValue={String(config.app ?? "other")}
              onChange={(e) =>
                applyConfig({
                  ...config,
                  app: e.target.value,
                  event_type: String(config.event_type ?? ""),
                })
              }
            >
              <option value="telegram">Telegram</option>
              <option value="notion">Notion</option>
              <option value="airtable">Airtable</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="app-event-type">Event type (placeholder)</Label>
            <Input
              id="app-event-type"
              defaultValue={String(config.event_type ?? "")}
              placeholder="e.g. message_received"
              onBlur={(e) =>
                applyConfig({
                  ...config,
                  event_type: e.target.value.trim(),
                })
              }
            />
            <p className="text-xs text-zinc-500">Real app events require integration setup.</p>
          </div>
        </div>
      )}

      {selectedNode.type === "simple_llm" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="sl-model">Model</Label>
            <select
              id="sl-model"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              value={String(config.model ?? "gpt-4o-mini")}
              onChange={(e) =>
                applyConfig({
                  ...config,
                  model: e.target.value,
                  prompt: String(config.prompt ?? ""),
                  temperature: Number(config.temperature ?? 0.7),
                  max_tokens: Number(config.max_tokens ?? 1024),
                })
              }
            >
              {LLM_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sl-prompt">Prompt</Label>
            <textarea
              id="sl-prompt"
              rows={4}
              className="min-h-[80px] w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              defaultValue={String(config.prompt ?? "")}
              onBlur={(e) =>
                applyConfig({
                  ...config,
                  model: String(config.model ?? "gpt-4o-mini"),
                  prompt: e.target.value,
                  temperature: Number(config.temperature ?? 0.7),
                  max_tokens: Number(config.max_tokens ?? 1024),
                })
              }
            />
            <div className="flex flex-wrap gap-1">
              {["{{input.query}}", "{{input.prompt}}", "{{input.text}}"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    const ta = document.getElementById("sl-prompt") as HTMLTextAreaElement;
                    if (ta) {
                      const start = ta.selectionStart;
                      const end = ta.selectionEnd;
                      const before = ta.value.slice(0, start);
                      const after = ta.value.slice(end);
                      const next = before + v + after;
                      ta.value = next;
                      ta.focus();
                      ta.setSelectionRange(start + v.length, start + v.length);
                      applyConfig({
                        ...config,
                        prompt: next,
                        model: String(config.model ?? "gpt-4o-mini"),
                        temperature: Number(config.temperature ?? 0.7),
                        max_tokens: Number(config.max_tokens ?? 1024),
                      });
                    }
                  }}
                  className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-300 hover:bg-zinc-700"
                >
                  {v}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500">Insert variables from previous steps</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sl-temp">Temperature</Label>
            <Input
              id="sl-temp"
              type="number"
              step="0.1"
              defaultValue={String(config.temperature ?? 0.7)}
              onBlur={(e) =>
                applyConfig({
                  ...config,
                  model: String(config.model ?? "gpt-4o-mini"),
                  prompt: String(config.prompt ?? ""),
                  temperature: parseNumber(e.target.value),
                  max_tokens: Number(config.max_tokens ?? 1024),
                })
              }
            />
          </div>
        </div>
      )}

      {selectedNode.type === "http_request" && (
        <HttpRequestConfig config={config} applyConfig={applyConfig} />
      )}

      {selectedNode.type === "research" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="research-model">Model</Label>
            <Input
              id="research-model"
              placeholder="perplexity/llama-3.1-sonar-small-128k-online"
              defaultValue={String(config.model ?? "perplexity/llama-3.1-sonar-small-128k-online")}
              onBlur={(e) => applyConfig({ ...config, model: e.target.value || "perplexity/llama-3.1-sonar-small-128k-online" })}
            />
            <p className="text-xs text-zinc-500">Perplexity model for web-grounded research. Needs PERPLEXITY_API_KEY.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="research-system">System prompt (optional)</Label>
            <textarea
              id="research-system"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 min-h-[60px]"
              placeholder="e.g. Focus on recent data, cite sources."
              defaultValue={String(config.system_prompt ?? "")}
              onBlur={(e) => applyConfig({ ...config, system_prompt: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="research-max-tokens">Max tokens</Label>
            <Input
              id="research-max-tokens"
              type="number"
              min={256}
              max={4096}
              defaultValue={String(config.max_tokens ?? 2048)}
              onBlur={(e) => {
                const v = parseInt(e.target.value, 10);
                applyConfig({ ...config, max_tokens: Number.isFinite(v) ? Math.min(4096, Math.max(256, v)) : 2048 });
              }}
            />
          </div>
        </div>
      )}

      {selectedNode.type === "web_scrape" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="web-scrape-url">URL (optional)</Label>
            <Input
              id="web-scrape-url"
              placeholder="Leave empty to use url from input"
              defaultValue={String(config.url ?? "")}
              onBlur={(e) => applyConfig({ ...config, url: e.target.value })}
            />
            <p className="text-xs text-zinc-500">Fixed URL here, or pass url in workflow input. Needs FIRECRAWL_API_KEY.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="web-scrape-format">Format</Label>
            <select
              id="web-scrape-format"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              value={String(config.format ?? "markdown")}
              onChange={(e) => applyConfig({ ...config, format: e.target.value })}
            >
              <option value="markdown">Markdown</option>
              <option value="html">HTML</option>
            </select>
          </div>
        </div>
      )}

      {selectedNode.type === "vision_extract" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="vision-model">Model</Label>
            <select
              id="vision-model"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              value={String(config.model ?? "gpt-4o-mini")}
              onChange={(e) => applyConfig({ ...config, model: e.target.value })}
            >
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-4-turbo">gpt-4-turbo</option>
            </select>
            <p className="text-xs text-zinc-500">Vision model. Input: image_url or image_base64 from state.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="vision-system">System prompt (optional)</Label>
            <textarea
              id="vision-system"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 min-h-[60px]"
              placeholder="e.g. Extract invoice fields as JSON: amount, date, vendor."
              defaultValue={String(config.system_prompt ?? "")}
              onBlur={(e) => applyConfig({ ...config, system_prompt: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vision-max-tokens">Max tokens</Label>
            <Input
              id="vision-max-tokens"
              type="number"
              min={256}
              max={4096}
              defaultValue={String(config.max_tokens ?? 1024)}
              onBlur={(e) => {
                const v = parseInt(e.target.value, 10);
                applyConfig({ ...config, max_tokens: Number.isFinite(v) ? Math.min(4096, Math.max(256, v)) : 1024 });
              }}
            />
          </div>
        </div>
      )}

      {selectedNode.type === "sql_query" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="sql-query">SQL query</Label>
            <textarea
              id="sql-query"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 min-h-[80px] font-mono"
              placeholder="SELECT * FROM leads WHERE status = $1"
              defaultValue={String(config.query ?? "")}
              onBlur={(e) => applyConfig({ ...config, query: e.target.value })}
            />
            <p className="text-xs text-zinc-500">Use $1, $2 for params. Set DATABASE_URL in Run settings.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sql-params">Params (JSON array)</Label>
            <Input
              id="sql-params"
              placeholder='["active"]'
              defaultValue={typeof config.params === "string" ? config.params : JSON.stringify(config.params ?? [])}
              onBlur={(e) => {
                try {
                  const p = JSON.parse(e.target.value || "[]");
                  applyConfig({ ...config, params: Array.isArray(p) ? p : [p] });
                } catch {
                  applyConfig({ ...config, params: [] });
                }
              }}
            />
          </div>
        </div>
      )}

      {selectedNode.type === "loop" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="loop-array-key">Array key in input</Label>
            <Input
              id="loop-array-key"
              placeholder="items"
              defaultValue={String(config.array_key ?? "items")}
              onBlur={(e) => applyConfig({ ...config, array_key: e.target.value || "items" })}
            />
            <p className="text-xs text-zinc-500">Connect this node to the node to run per item. Use {"{{item}}"} and {"{{index}}"} in the body node.</p>
          </div>
        </div>
      )}

      {selectedNode.type === "template_render" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="template-content">Template</Label>
            <textarea
              id="template-content"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 min-h-[80px]"
              placeholder="Hello {{input.name}}, result: {{output}}"
              defaultValue={String(config.template ?? "")}
              onBlur={(e) => applyConfig({ ...config, template: e.target.value })}
            />
            <p className="text-xs text-zinc-500">Use {"{{input.key}}"} or {"{{nodeId.outputKey}}"} for values.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="template-output-key">Output key</Label>
            <Input
              id="template-output-key"
              placeholder="rendered"
              defaultValue={String(config.output_key ?? "rendered")}
              onBlur={(e) => applyConfig({ ...config, output_key: e.target.value || "rendered" })}
            />
          </div>
        </div>
      )}

      {selectedNode.type === "pdf_report" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="pdf-content-key">Content key in state</Label>
            <Input
              id="pdf-content-key"
              placeholder="output"
              defaultValue={String(config.content_key ?? "output")}
              onBlur={(e) => applyConfig({ ...config, content_key: e.target.value || "output" })}
            />
            <p className="text-xs text-zinc-500">Key containing text or HTML to turn into PDF.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pdf-filename">Filename</Label>
            <Input
              id="pdf-filename"
              placeholder="report.pdf"
              defaultValue={String(config.filename ?? "report.pdf")}
              onBlur={(e) => applyConfig({ ...config, filename: e.target.value || "report.pdf" })}
            />
          </div>
        </div>
      )}

      {selectedNode.type === "wait_callback" && (
        <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-400">
          Pauses the run and outputs resume_url. POST to that URL (optional body merged into state) to continue. Connect the next node after this one.
        </div>
      )}

      {selectedNode.type === "error_handler" && (
        <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-400">
          Connect from a node that might fail. When that node throws, execution continues here. Input will contain error message.
        </div>
      )}

      {selectedNode.type === "set_node" && (
        <SetNodeConfig
          config={config}
          applyConfig={applyConfig}
          mode={mode}
        />
      )}

      {selectedNode.type === "json_parse" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="json-parse-source">Source key</Label>
            <Input
              id="json-parse-source"
              placeholder="body"
              defaultValue={String(config.source_key ?? "body")}
              onBlur={(e) =>
                applyConfig({
                  ...config,
                  source_key: e.target.value || "body",
                })
              }
            />
            <p className="text-xs text-zinc-500">Key in input containing the JSON string (e.g. body from HTTP response).</p>
          </div>
        </div>
      )}

      {selectedNode.type === "merge" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="merge-mode">Merge mode</Label>
            <select
              id="merge-mode"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              value={String(config.mode ?? "shallow")}
              onChange={(e) => applyConfig({ ...config, mode: e.target.value })}
            >
              <option value="shallow">Shallow (later overwrites)</option>
              <option value="deep">Deep (nested merge)</option>
            </select>
            <p className="text-xs text-zinc-500">How to combine outputs from multiple branches.</p>
          </div>
        </div>
      )}

      {selectedNode.type === "filter" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="filter-source">Source key (array)</Label>
            <Input
              id="filter-source"
              placeholder="data"
              defaultValue={String(config.source_key ?? "data")}
              onBlur={(e) =>
                applyConfig({
                  ...config,
                  source_key: e.target.value || "data",
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filter-expr">Filter expression</Label>
            <Input
              id="filter-expr"
              placeholder="{{item}} or {{item.active}}"
              defaultValue={String(config.expr ?? "{{item}}")}
              onBlur={(e) =>
                applyConfig({
                  ...config,
                  expr: e.target.value || "{{item}}",
                })
              }
            />
            <p className="text-xs text-zinc-500">Keep items where this expression is truthy. Use {"{{item}}"} for the current item.</p>
          </div>
        </div>
      )}

      {selectedNode.type === "json_stringify" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="json-stringify-source">Source key</Label>
            <Input
              id="json-stringify-source"
              placeholder="data"
              defaultValue={String(config.source_key ?? "data")}
              onBlur={(e) =>
                applyConfig({
                  ...config,
                  source_key: e.target.value || "data",
                })
              }
            />
            <p className="text-xs text-zinc-500">Key in input containing the object to stringify.</p>
          </div>
        </div>
      )}

      {selectedNode.type === "delay" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="delay-seconds">Delay (seconds)</Label>
            <Input
              id="delay-seconds"
              type="number"
              min={0.1}
              max={3600}
              step={1}
              defaultValue={String(config.seconds ?? 5)}
              onBlur={(e) => {
                const v = parseFloat(e.target.value);
                const seconds = Number.isFinite(v) ? Math.max(0.1, Math.min(3600, v)) : 5;
                applyConfig({ ...config, seconds });
              }}
            />
            <p className="text-xs text-zinc-500">Pause execution for this many seconds (0.1–3600).</p>
          </div>
        </div>
      )}

      {selectedNode.type === "approval_step" && (
        <div className="rounded-md border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-400">
          Approval node can pause execution until reviewer approval is submitted.
        </div>
      )}

      {selectedNode.type === "ai_agent" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="agent-model">Model</Label>
            <select
              id="agent-model"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              value={String(config.model ?? "gpt-4o-mini")}
              onChange={(e) =>
                applyConfig({
                  ...config,
                  model: e.target.value,
                  system_prompt: String(config.system_prompt ?? ""),
                  tools: Array.isArray(config.tools) ? config.tools : [],
                  memory_source: String(config.memory_source ?? ""),
                  output_mode: String(config.output_mode ?? "text"),
                })
              }
            >
              {LLM_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="agent-system">System prompt (optional)</Label>
            <textarea
              id="agent-system"
              className="min-h-[80px] w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              defaultValue={String(config.system_prompt ?? "")}
              onBlur={(e) =>
                applyConfig({
                  ...config,
                  model: String(config.model ?? "gpt-4o-mini"),
                  system_prompt: e.target.value,
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="agent-tools">Tools (comma separated)</Label>
            <Input
              id="agent-tools"
              defaultValue={Array.isArray(config.tools) ? (config.tools as string[]).join(", ") : ""}
              onBlur={(e) =>
                applyConfig({
                  ...config,
                  tools: e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="agent-memory">Memory source (optional)</Label>
            <Input
              id="agent-memory"
              defaultValue={String(config.memory_source ?? "")}
              placeholder="e.g. invoices, leads, documents"
              onBlur={(e) =>
                applyConfig({
                  ...config,
                  memory_source: e.target.value.trim(),
                })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="agent-output">Output mode</Label>
            <select
              id="agent-output"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              defaultValue={String(config.output_mode ?? "text")}
              onChange={(e) =>
                applyConfig({
                  ...config,
                  output_mode: e.target.value,
                })
              }
            >
              <option value="text">Text</option>
              <option value="json">JSON</option>
            </select>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

      <Button
        variant="ghost"
        className="mt-4 w-full"
        onClick={() => onUpdateNodeConfig(selectedNode.id, {})}
      >
        Reset config
      </Button>
    </aside>
  );
}
