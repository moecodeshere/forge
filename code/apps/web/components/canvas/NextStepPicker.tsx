"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { ForgeNodeType } from "@/lib/stores/graphStore";
import { Input } from "@/components/ui/input";

const CATEGORIES = [
  { id: "ai", label: "AI", description: "Build autonomous agents, summarize or search documents, etc." },
  { id: "actions", label: "Action in an app", description: "Do something in an app or service like Google Sheets, Telegram or Notion" },
  { id: "data", label: "Data transformation", description: "Manipulate, filter or convert data" },
  { id: "flow", label: "Flow", description: "Branch, merge or loop the flow, etc." },
  { id: "core", label: "Core", description: "Run code, make HTTP requests, set webhooks, etc." },
  { id: "human", label: "Human review", description: "Request approval via services like Slack and Telegram before making tool calls" },
  { id: "triggers", label: "Add another trigger", description: "Triggers start your workflow. Workflows can have multiple triggers." },
] as const;

const NODES_BY_CATEGORY: Record<string, Array<{ type: ForgeNodeType; label: string }>> = {
  ai: [
    { type: "simple_llm", label: "Simple LLM" },
    { type: "llm_caller", label: "LLM Caller" },
    { type: "ai_agent", label: "AI Agent" },
    { type: "rag_retriever", label: "RAG Retriever" },
    { type: "research", label: "Web Research" },
    { type: "vision_extract", label: "Extract from Image" },
    { type: "web_scrape", label: "Web Scrape" },
  ],
  actions: [
    { type: "http_request", label: "HTTP Request" },
    { type: "mcp_tool", label: "MCP (Registry)" },
    { type: "action", label: "Action (Gmail, Slack, …)" },
    { type: "pdf_report", label: "PDF Report" },
  ],
  data: [
    { type: "set_node", label: "Set / map fields" },
    { type: "template_render", label: "Template (render text/HTML)" },
    { type: "json_parse", label: "JSON Parse" },
    { type: "json_stringify", label: "JSON Stringify" },
    { type: "merge", label: "Merge branches" },
    { type: "sql_query", label: "SQL Query" },
  ],
  flow: [
    { type: "conditional_branch", label: "Conditional Branch" },
    { type: "delay", label: "Delay" },
    { type: "loop", label: "Loop (for each)" },
    { type: "wait_callback", label: "Wait for Callback" },
    { type: "error_handler", label: "Error Handler" },
    { type: "filter", label: "Filter array" },
  ],
  core: [
    { type: "http_request", label: "HTTP Request" },
    { type: "set_node", label: "Set" },
    { type: "mcp_tool", label: "MCP tool" },
  ],
  human: [{ type: "approval_step", label: "Approval Step" }],
  triggers: [
    { type: "manual_trigger", label: "Trigger manually" },
    { type: "webhook_trigger", label: "On webhook call" },
    { type: "schedule_trigger", label: "On a schedule" },
    { type: "form_submission_trigger", label: "On form submission" },
    { type: "app_event_trigger", label: "On app event" },
  ],
};

interface NextStepPickerProps {
  onSelect: (nodeType: ForgeNodeType) => void;
  onClose: () => void;
}

export function NextStepPicker({ onSelect, onClose }: NextStepPickerProps) {
  const [search, setSearch] = useState("");

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return CATEGORIES;
    const q = search.trim().toLowerCase();
    return CATEGORIES.filter((cat) => {
      const nodes = NODES_BY_CATEGORY[cat.id] ?? [];
      return (
        cat.label.toLowerCase().includes(q) ||
        cat.description.toLowerCase().includes(q) ||
        nodes.some((n) => n.label.toLowerCase().includes(q))
      );
    });
  }, [search]);

  return (
    <div className="absolute right-0 top-0 z-30 flex h-full w-[400px] flex-col border-l border-zinc-800 bg-zinc-950 shadow-xl">
      <div className="border-b border-zinc-800 p-4">
        <h2 className="text-sm font-semibold text-zinc-100">What happens next?</h2>
        <div className="mt-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes..."
            className="h-9 bg-zinc-900"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {filteredCategories.map((cat) => (
          <div key={cat.id} className="mb-3">
            <div className="mb-1 flex items-center gap-2 px-2 py-1">
              <span className="text-xs font-medium text-zinc-400">{cat.label}</span>
            </div>
            <p className="mb-2 px-2 text-[11px] text-zinc-500">{cat.description}</p>
            <div className="space-y-0.5">
              {(NODES_BY_CATEGORY[cat.id] ?? []).map((node) => (
                <button
                  key={node.type}
                  type="button"
                  onClick={() => {
                    onSelect(node.type);
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left transition hover:border-zinc-700 hover:bg-zinc-900/80"
                >
                  <span className="text-sm font-medium text-zinc-200">{node.label}</span>
                  <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-zinc-500" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-800 p-2">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          Close
        </button>
      </div>
    </div>
  );
}
