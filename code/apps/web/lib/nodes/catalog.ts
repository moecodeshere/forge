import type { ForgeNodeType } from "@/lib/stores/graphStore";

export type NodeCategory = "Triggers" | "AI" | "MCP" | "Actions" | "Data" | "Logic" | "Flow" | "Human";

/** Includes "All" for palette filter UI (not a node category). */
export type PaletteFilterCategory = "All" | NodeCategory;

export interface NodeCatalogEntry {
  type: ForgeNodeType;
  label: string;
  category: NodeCategory;
  shortDescription: string;
  beginnerFriendly: boolean;
}

// Frontend catalog mirroring backend NodePluginMeta definitions.
// When adding a new node plugin, update this list so the palette and templates stay in sync.
export const NODE_CATALOG: NodeCatalogEntry[] = [
  {
    type: "manual_trigger",
    label: "Manual Trigger",
    category: "Triggers",
    shortDescription: "Start the workflow manually or via API.",
    beginnerFriendly: true,
  },
  {
    type: "webhook_trigger",
    label: "Webhook Trigger",
    category: "Triggers",
    shortDescription: "Run when an HTTP request hits your webhook URL.",
    beginnerFriendly: false,
  },
  {
    type: "schedule_trigger",
    label: "Schedule",
    category: "Triggers",
    shortDescription: "Run on a fixed schedule (hourly, daily, etc.).",
    beginnerFriendly: true,
  },
  {
    type: "form_submission_trigger",
    label: "Form Submission",
    category: "Triggers",
    shortDescription: "Start when a user submits a form.",
    beginnerFriendly: true,
  },
  {
    type: "app_event_trigger",
    label: "App Event",
    category: "Triggers",
    shortDescription: "Listen for events from external apps.",
    beginnerFriendly: false,
  },
  {
    type: "simple_llm",
    label: "Simple LLM",
    category: "AI",
    shortDescription: "Call an LLM with a prompt and optional context.",
    beginnerFriendly: true,
  },
  {
    type: "llm_caller",
    label: "LLM Caller",
    category: "AI",
    shortDescription: "Advanced LLM call with system prompt and settings.",
    beginnerFriendly: true,
  },
  {
    type: "ai_agent",
    label: "AI Agent",
    category: "AI",
    shortDescription: "Reason over context with tools and memory.",
    beginnerFriendly: false,
  },
  {
    type: "rag_retriever",
    label: "RAG Retriever",
    category: "AI",
    shortDescription: "Search stored documents for relevant context.",
    beginnerFriendly: true,
  },
  {
    type: "research",
    label: "Web Research",
    category: "AI",
    shortDescription: "Web-grounded research (Perplexity). Reports with sources.",
    beginnerFriendly: true,
  },
  {
    type: "web_scrape",
    label: "Web Scrape",
    category: "Data",
    shortDescription: "Crawl a URL and get markdown (Firecrawl).",
    beginnerFriendly: false,
  },
  {
    type: "vision_extract",
    label: "Extract from Image",
    category: "AI",
    shortDescription: "Extract structured data from images (e.g. invoices).",
    beginnerFriendly: true,
  },
  {
    type: "sql_query",
    label: "SQL Query",
    category: "Data",
    shortDescription: "Run parameterized SQL (Postgres). Uses DATABASE_URL.",
    beginnerFriendly: false,
  },
  {
    type: "loop",
    label: "Loop (For Each)",
    category: "Flow",
    shortDescription: "Run the next node once per item. Use {{item}} and {{index}}.",
    beginnerFriendly: false,
  },
  {
    type: "template_render",
    label: "Template (Render)",
    category: "Data",
    shortDescription: "Render text/HTML from {{path}} expressions.",
    beginnerFriendly: true,
  },
  {
    type: "pdf_report",
    label: "PDF Report",
    category: "Actions",
    shortDescription: "Generate a PDF from text or content.",
    beginnerFriendly: true,
  },
  {
    type: "wait_callback",
    label: "Wait for Callback",
    category: "Flow",
    shortDescription: "Pause and output resume URL; POST to continue.",
    beginnerFriendly: false,
  },
  {
    type: "error_handler",
    label: "Error Handler",
    category: "Flow",
    shortDescription: "Runs when a connected node fails. Use for alerts or fallback.",
    beginnerFriendly: false,
  },
  {
    type: "mcp_tool",
    label: "MCP (Registry)",
    category: "MCP",
    shortDescription: "Use a tool from the Official MCP Registry.",
    beginnerFriendly: false,
  },
  {
    type: "action",
    label: "Action",
    category: "Actions",
    shortDescription: "Gmail, Slack, Telegram, Google Search, Sheets, Notion.",
    beginnerFriendly: true,
  },
  {
    type: "http_request",
    label: "HTTP Request",
    category: "Actions",
    shortDescription: "Call any HTTP API and use the response.",
    beginnerFriendly: true,
  },
  {
    type: "set_node",
    label: "Set",
    category: "Data",
    shortDescription: "Set or transform fields on the workflow state.",
    beginnerFriendly: true,
  },
  {
    type: "conditional_branch",
    label: "Conditional Branch",
    category: "Logic",
    shortDescription: "Route the workflow based on a condition.",
    beginnerFriendly: false,
  },
  {
    type: "delay",
    label: "Delay",
    category: "Flow",
    shortDescription: "Pause execution for N seconds before continuing.",
    beginnerFriendly: true,
  },
  {
    type: "json_parse",
    label: "JSON Parse",
    category: "Data",
    shortDescription: "Parse a JSON string into an object.",
    beginnerFriendly: true,
  },
  {
    type: "json_stringify",
    label: "JSON Stringify",
    category: "Data",
    shortDescription: "Serialize an object to a JSON string.",
    beginnerFriendly: true,
  },
  {
    type: "merge",
    label: "Merge",
    category: "Data",
    shortDescription: "Combine multiple branch outputs into one object.",
    beginnerFriendly: true,
  },
  {
    type: "filter",
    label: "Filter",
    category: "Logic",
    shortDescription: "Filter an array by expression (e.g. {{item.active}}).",
    beginnerFriendly: false,
  },
  {
    type: "approval_step",
    label: "Approval Step",
    category: "Human",
    shortDescription: "Pause the run until a human approves or rejects.",
    beginnerFriendly: true,
  },
];

export const PALETTE_CATEGORIES: PaletteFilterCategory[] = [
  "All",
  "Triggers",
  "AI",
  "MCP",
  "Actions",
  "Data",
  "Logic",
  "Flow",
  "Human",
];

