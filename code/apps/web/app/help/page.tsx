"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Book,
  Play,
  Key,
  Shield,
  Plug,
  Zap,
  Cloud,
  Code,
} from "lucide-react";

const sections = [
  {
    icon: Book,
    title: "Quick start",
    items: [
      "Go to Dashboard and pick a complex template (e.g. Invoice processing or RAG knowledge assistant) or use Create with AI.",
      "Open a workflow, add nodes, and connect them. The graph auto-saves as you edit.",
      "Click Run (or ⌘+Enter) to execute. View results in the Execution log panel.",
    ],
  },
  {
    icon: Play,
    title: "How to run an agent",
    items: [
      "Use a Manual trigger (or Webhook / Schedule) as the first node, then add steps (LLM, RAG, HTTP, etc.).",
      "Click Run in the canvas header, or use Run settings to pass input (e.g. query) and API keys.",
      "Long runs can continue in the background; open the Executions tab to see status and logs.",
      "Approval nodes pause the run until you Approve or Reject in the Execution log.",
    ],
  },
  {
    icon: Plug,
    title: "How to add MCP",
    items: [
      "MCP = tools from the Official MCP Registry only. Add an “MCP” node from the palette.",
      "Search or browse the integrated registry and pick a server; then choose a tool and configure parameters.",
      "Do not use the MCP node for Gmail, Slack, etc. — those are Actions (see below).",
    ],
  },
  {
    icon: Zap,
    title: "How to add Actions",
    items: [
      "Actions are built-in integrations: Gmail, Slack, Telegram, Google Search, Sheets, Notion, etc.",
      "Add an “Action” node from the palette, then pick provider and action (e.g. Gmail – Send email).",
      "Configure in the node panel. Credentials come from Run settings or saved API keys.",
    ],
  },
  {
    icon: Cloud,
    title: "How to deploy as MCP",
    items: [
      "Click Deploy in the canvas header. Choose Cloud (Vercel) and check “Expose as MCP” to get an MCP URL.",
      "Or choose “MCP Server” to get a manifest and URL without deploying to Vercel.",
      "Copy the MCP URL and add it in Claude or Cursor MCP settings. Use your Forge API token as Bearer auth.",
    ],
  },
  {
    icon: Code,
    title: "How to export code",
    items: [
      "Click Deploy → choose “Export Code”. Download the ZIP (LangGraph + FastAPI project).",
      "Unzip, then: pip install -r requirements.txt, add keys to .env, run uvicorn app:app --reload.",
      "POST /run with JSON body to execute; GET /docs for OpenAPI. You can run and host the workflow yourself.",
    ],
  },
  {
    icon: Key,
    title: "API keys",
    items: [
      "Add OpenAI, Anthropic, Google (and optional Gmail) in Run settings or the Settings page.",
      "Use “Save keys to account” to store them encrypted on the server so runs work without re-entering.",
      "Keys are merged at run time; request secrets override stored keys.",
    ],
  },
  {
    icon: Shield,
    title: "Data safety",
    items: [
      "API keys can be saved to your account (AES-256 encrypted) or kept in Run settings only.",
      "Checkpoints (run state) are encrypted with AES-256-GCM before storage.",
      "Workflow definitions and run metadata are stored in Supabase.",
    ],
  },
];

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <h1 className="text-2xl font-semibold">Help</h1>
        <p className="mt-1 text-sm text-zinc-400">
          How to run agents, add MCP and Actions, deploy, and export.
        </p>

        <div className="mt-8 space-y-6">
          {sections.map(({ icon: Icon, title, items }) => (
            <section
              key={title}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6"
            >
              <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
                <Icon className="h-4 w-4 shrink-0" />
                {title}
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                {items.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-zinc-600">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
