import type { Edge } from "@xyflow/react";

import type { ForgeNode } from "@/lib/stores/graphStore";

export interface WorkflowTemplate {
  id: string;
  name: string;
  category: "operations" | "marketing" | "support" | "ai" | "engineering" | "sales";
  description: string;
  estimatedSetupMinutes: number;
  nodes: ForgeNode[];
  edges: Edge[];
  /** Tags for marketplace / discovery */
  tags?: string[];
  /** Stripe / marketplace hint (e.g. metered price id) */
  billingHint?: string;
}

const viewport = { x: 0, y: 0, zoom: 1 };

/** Placeholder MCP URL — replace with your GitHub / registry MCP endpoint in production. */
const MCP_GITHUB = "https://github-mcp.placeholder.local/sse";
const MCP_WEB_SEARCH = "https://web-search-mcp.placeholder.local/sse";
const MCP_ENRICH = "https://enrichment-mcp.placeholder.local/sse";

const TRIAGE_SYSTEM = `You are a senior engineer triaging GitHub issues. Use repo context and RAG snippets.
Classify severity, list reproduction steps, and suggest a fix or PR comment.
If the issue is critical OR you are not confident (ambiguous, security-sensitive), include the exact line NEEDS_REVIEW on its own line.
Otherwise include AUTO_OK on its own line.`;

const SUPPORT_DRAFT_SYSTEM = `Draft a customer reply using the FAQ/docs context. Be concise and on-brand.
If the case requires a human (escalation, legal, negative sentiment, or high complexity), include ESCALATE on its own line.
Otherwise include AUTO_SEND on its own line.`;

const LEAD_SCORE_SYSTEM = `Score the lead 0–100 and draft a short outreach email.
If score is 80 or above, include HIGH_VALUE on its own line.
Otherwise include NEEDS_APPROVAL on its own line.`;

/**
 * Validates a workflow DAG: no cycles, all edges reference existing nodes (NetworkX-style acyclic check).
 */
export function validateWorkflowDAG(
  nodes: ForgeNode[],
  edges: Edge[],
): { ok: true } | { ok: false; error: string } {
  const nodeIds = new Set(nodes.map((n) => n.id));
  if (nodes.length === 0) {
    return { ok: false, error: "Graph has no nodes" };
  }
  for (const e of edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) {
      return { ok: false, error: `Edge ${e.id} references unknown node` };
    }
  }
  const indegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) {
    indegree.set(id, 0);
    adj.set(id, []);
  }
  for (const e of edges) {
    adj.get(e.source)!.push(e.target);
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
  }
  const queue: string[] = [];
  for (const [id, d] of indegree) {
    if (d === 0) queue.push(id);
  }
  let seen = 0;
  while (queue.length) {
    const u = queue.shift()!;
    seen++;
    for (const v of adj.get(u) ?? []) {
      indegree.set(v, (indegree.get(v) ?? 0) - 1);
      if (indegree.get(v) === 0) queue.push(v);
    }
  }
  if (seen !== nodeIds.size) {
    return { ok: false, error: "Graph contains a cycle or invalid topology" };
  }
  return { ok: true };
}

function registerTemplates(templates: WorkflowTemplate[]): WorkflowTemplate[] {
  for (const t of templates) {
    const v = validateWorkflowDAG(t.nodes, t.edges);
    if (!v.ok) {
      throw new Error(`Template "${t.id}" is invalid: ${v.error}`);
    }
  }
  return templates;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = registerTemplates([
  {
    id: "github-issue-triage",
    name: "GitHub Issue Auto-Triage + Resolver",
    category: "engineering",
    description:
      "RAG repo context → GitHub MCP → LLM triage → human approval only when NEEDS_REVIEW, else auto comment/PR.",
    estimatedSetupMinutes: 25,
    tags: ["github", "mcp", "rag", "approval", "marketplace"],
    billingHint: "metered: $0.01/call after free tier",
    nodes: [
      {
        id: "start",
        type: "manual_trigger",
        position: { x: 40, y: 200 },
        data: { label: "Start (manual / API)", config: {} },
      },
      {
        id: "rag_kb",
        type: "rag_retriever",
        position: { x: 320, y: 200 },
        data: {
          label: "Repo KB (RAG)",
          config: {
            embedding_model: "text-embedding-3-large",
            top_k: 8,
            min_score: 0.55,
          },
        },
      },
      {
        id: "mcp_issue_ctx",
        type: "mcp_tool",
        position: { x: 600, y: 200 },
        data: {
          label: "MCP: issue context",
          config: {
            server_url: MCP_GITHUB,
            tool_name: "get_issue_context",
            params: {},
          },
        },
      },
      {
        id: "llm_triage",
        type: "llm_caller",
        position: { x: 880, y: 200 },
        data: {
          label: "Triage & draft",
          config: {
            model: "gpt-4o",
            temperature: 0.3,
            max_tokens: 2048,
            system_prompt: TRIAGE_SYSTEM,
          },
        },
      },
      {
        id: "branch_risk",
        type: "conditional_branch",
        position: { x: 1160, y: 200 },
        data: {
          label: "Escalate?",
          config: {
            expression: "'NEEDS_REVIEW' in str(_input.get('output', ''))",
          },
        },
      },
      {
        id: "approval_human",
        type: "approval_step",
        position: { x: 1440, y: 80 },
        data: {
          label: "Human review",
          config: {
            title: "Approve triage / comment",
            form_schema: {
              type: "object",
              properties: {
                approve: { type: "boolean" },
                comment: { type: "string" },
              },
            },
          },
        },
      },
      {
        id: "mcp_resolve",
        type: "mcp_tool",
        position: { x: 1440, y: 320 },
        data: {
          label: "MCP: post comment / PR",
          config: {
            server_url: MCP_GITHUB,
            tool_name: "post_comment_or_create_pr",
            params: {},
          },
        },
      },
      {
        id: "merge_out",
        type: "merge",
        position: { x: 1720, y: 200 },
        data: { label: "Merge paths", config: { mode: "deep" } },
      },
    ],
    edges: [
      { id: "e-g-1", source: "start", target: "rag_kb" },
      { id: "e-g-2", source: "rag_kb", target: "mcp_issue_ctx" },
      { id: "e-g-3", source: "mcp_issue_ctx", target: "llm_triage" },
      { id: "e-g-4", source: "llm_triage", target: "branch_risk" },
      { id: "e-g-5", source: "branch_risk", target: "approval_human", label: "true" },
      { id: "e-g-6", source: "branch_risk", target: "mcp_resolve", label: "false" },
      { id: "e-g-7", source: "approval_human", target: "merge_out" },
      { id: "e-g-8", source: "mcp_resolve", target: "merge_out" },
    ],
  },
  {
    id: "customer-support-agent",
    name: "Intelligent Customer Support Agent",
    category: "support",
    description:
      "Intent + sentiment → RAG FAQs → draft reply → approval only when ESCALATE; else Gmail send.",
    estimatedSetupMinutes: 20,
    tags: ["support", "rag", "stripe-ready", "gmail"],
    billingHint: "Support Agent — metered after free tier",
    nodes: [
      {
        id: "intent",
        type: "llm_caller",
        position: { x: 120, y: 200 },
        data: {
          label: "Intent + sentiment",
          config: {
            model: "gpt-4o",
            temperature: 0.2,
            max_tokens: 800,
            system_prompt:
              "Extract intent, sentiment, product area from the ticket. Output JSON summary in the message.",
          },
        },
      },
      {
        id: "rag_faq",
        type: "rag_retriever",
        position: { x: 400, y: 200 },
        data: {
          label: "Knowledge base (RAG)",
          config: {
            embedding_model: "text-embedding-3-large",
            top_k: 10,
            min_score: 0.5,
          },
        },
      },
      {
        id: "draft_reply",
        type: "llm_caller",
        position: { x: 680, y: 200 },
        data: {
          label: "Draft reply",
          config: {
            model: "gpt-4o",
            temperature: 0.4,
            max_tokens: 1200,
            system_prompt: SUPPORT_DRAFT_SYSTEM,
          },
        },
      },
      {
        id: "branch_escalate",
        type: "conditional_branch",
        position: { x: 960, y: 200 },
        data: {
          label: "Escalate?",
          config: {
            expression: "'ESCALATE' in str(_input.get('output', ''))",
          },
        },
      },
      {
        id: "approval_support",
        type: "approval_step",
        position: { x: 1240, y: 80 },
        data: {
          label: "Human approval",
          config: {
            title: "Approve outbound reply",
            form_schema: {
              type: "object",
              properties: {
                approve: { type: "boolean" },
                comment: { type: "string" },
              },
            },
          },
        },
      },
      {
        id: "send_gmail",
        type: "action",
        position: { x: 1240, y: 320 },
        data: {
          label: "Gmail: send reply",
          config: {
            provider: "gmail",
            action: "send_email",
            test_mode: true,
            params: {
              to: "{{customer_email}}",
              subject: "Re: your request",
              body: "{{output}}",
            },
          },
        },
      },
      {
        id: "merge_support",
        type: "merge",
        position: { x: 1520, y: 200 },
        data: { label: "Done", config: { mode: "deep" } },
      },
    ],
    edges: [
      { id: "e-s-1", source: "intent", target: "rag_faq" },
      { id: "e-s-2", source: "rag_faq", target: "draft_reply" },
      { id: "e-s-3", source: "draft_reply", target: "branch_escalate" },
      { id: "e-s-4", source: "branch_escalate", target: "approval_support", label: "true" },
      { id: "e-s-5", source: "branch_escalate", target: "send_gmail", label: "false" },
      { id: "e-s-6", source: "approval_support", target: "merge_support" },
      { id: "e-s-7", source: "send_gmail", target: "merge_support" },
    ],
  },
  {
    id: "research-report-generator",
    name: "Research + Report Generator",
    category: "marketing",
    description:
      "Planner → web research + company RAG → first draft → optional fact-check branch → final polish with citations.",
    estimatedSetupMinutes: 22,
    tags: ["research", "rag", "mcp", "content"],
    nodes: [
      {
        id: "planner",
        type: "llm_caller",
        position: { x: 40, y: 200 },
        data: {
          label: "Query planner",
          config: {
            model: "gpt-4o",
            temperature: 0.3,
            max_tokens: 600,
            system_prompt:
              "Given the topic, output a concise research brief and key questions. One short paragraph.",
          },
        },
      },
      {
        id: "web_research",
        type: "research",
        position: { x: 320, y: 120 },
        data: {
          label: "Web research",
          config: {
            model: "perplexity/llama-3.1-sonar-small-128k-online",
            max_tokens: 2048,
          },
        },
      },
      {
        id: "company_rag",
        type: "rag_retriever",
        position: { x: 320, y: 280 },
        data: {
          label: "Company KB (RAG)",
          config: {
            embedding_model: "text-embedding-3-large",
            top_k: 8,
            min_score: 0.5,
          },
        },
      },
      {
        id: "merge_sources",
        type: "merge",
        position: { x: 600, y: 200 },
        data: { label: "Merge sources", config: { mode: "deep" } },
      },
      {
        id: "first_draft",
        type: "llm_caller",
        position: { x: 880, y: 200 },
        data: {
          label: "First draft",
          config: {
            model: "gpt-4o",
            temperature: 0.4,
            max_tokens: 3000,
            system_prompt:
              "Synthesize web + internal docs into a structured report draft with section headings.",
          },
        },
      },
      {
        id: "branch_cite",
        type: "conditional_branch",
        position: { x: 1160, y: 200 },
        data: {
          label: "Fact-check pass?",
          config: {
            expression: "'FACT_CHECK' in str(_input.get('output', '')) or len(str(_input.get('output', ''))) > 8000",
          },
        },
      },
      {
        id: "fact_mcp",
        type: "mcp_tool",
        position: { x: 1440, y: 120 },
        data: {
          label: "MCP: fact-check / search",
          config: {
            server_url: MCP_WEB_SEARCH,
            tool_name: "search_verify",
            params: {},
          },
        },
      },
      {
        id: "final_polish",
        type: "llm_caller",
        position: { x: 1440, y: 280 },
        data: {
          label: "Final polish + citations",
          config: {
            model: "gpt-4o",
            temperature: 0.25,
            max_tokens: 4000,
            system_prompt:
              "Produce Markdown with clear citations. If fact-check output exists, reconcile and cite.",
          },
        },
      },
    ],
    edges: [
      { id: "e-r-1", source: "planner", target: "web_research" },
      { id: "e-r-2", source: "planner", target: "company_rag" },
      { id: "e-r-3", source: "web_research", target: "merge_sources" },
      { id: "e-r-4", source: "company_rag", target: "merge_sources" },
      { id: "e-r-5", source: "merge_sources", target: "first_draft" },
      { id: "e-r-6", source: "first_draft", target: "branch_cite" },
      { id: "e-r-7", source: "branch_cite", target: "fact_mcp", label: "true" },
      { id: "e-r-8", source: "branch_cite", target: "final_polish", label: "false" },
      { id: "e-r-9", source: "fact_mcp", target: "final_polish" },
    ],
  },
  {
    id: "code-gen-review",
    name: "Code Generation + Review Agent",
    category: "engineering",
    description:
      "Fetch repo via MCP → generate → optional test MCP → self-review → approval if risky → open PR.",
    estimatedSetupMinutes: 28,
    tags: ["code", "mcp", "approval", "dev"],
    nodes: [
      {
        id: "mcp_fetch",
        type: "mcp_tool",
        position: { x: 40, y: 200 },
        data: {
          label: "MCP: fetch repo files",
          config: {
            server_url: MCP_GITHUB,
            tool_name: "fetch_repo_snapshot",
            params: {},
          },
        },
      },
      {
        id: "gen_code",
        type: "llm_caller",
        position: { x: 320, y: 200 },
        data: {
          label: "Generate code",
          config: {
            model: "gpt-4o",
            temperature: 0.2,
            max_tokens: 8000,
            system_prompt:
              "Implement the feature from requirements. Output code blocks and file paths. Include NEEDS_REVIEW if unsure.",
          },
        },
      },
      {
        id: "mcp_tests",
        type: "mcp_tool",
        position: { x: 600, y: 200 },
        data: {
          label: "MCP: tests / lint",
          config: {
            server_url: MCP_GITHUB,
            tool_name: "run_checks",
            params: {},
          },
        },
      },
      {
        id: "self_review",
        type: "llm_caller",
        position: { x: 880, y: 200 },
        data: {
          label: "Self-review",
          config: {
            model: "gpt-4o",
            temperature: 0.15,
            max_tokens: 4000,
            system_prompt: "Review generated code for bugs and tests. Summarize pass/fail.",
          },
        },
      },
      {
        id: "branch_pr",
        type: "conditional_branch",
        position: { x: 1160, y: 200 },
        data: {
          label: "Needs human PR?",
          config: {
            expression: "'NEEDS_REVIEW' in str(_input.get('output', ''))",
          },
        },
      },
      {
        id: "approval_code",
        type: "approval_step",
        position: { x: 1440, y: 120 },
        data: {
          label: "Approve PR",
          config: {
            title: "Approve creating PR",
            form_schema: {
              type: "object",
              properties: {
                approve: { type: "boolean" },
                comment: { type: "string" },
              },
            },
          },
        },
      },
      {
        id: "mcp_pr",
        type: "mcp_tool",
        position: { x: 1440, y: 280 },
        data: {
          label: "MCP: create PR",
          config: {
            server_url: MCP_GITHUB,
            tool_name: "create_pull_request",
            params: {},
          },
        },
      },
    ],
    edges: [
      { id: "e-c-1", source: "mcp_fetch", target: "gen_code" },
      { id: "e-c-2", source: "gen_code", target: "mcp_tests" },
      { id: "e-c-3", source: "mcp_tests", target: "self_review" },
      { id: "e-c-4", source: "self_review", target: "branch_pr" },
      { id: "e-c-5", source: "branch_pr", target: "approval_code", label: "true" },
      { id: "e-c-6", source: "branch_pr", target: "mcp_pr", label: "false" },
      { id: "e-c-7", source: "approval_code", target: "mcp_pr" },
    ],
  },
  {
    id: "sales-lead-qualifier",
    name: "Sales Lead Qualifier + Enrichment",
    category: "sales",
    description:
      "Extract lead → enrichment MCP → CRM RAG → score + draft → auto-send if HIGH_VALUE else approval → Gmail.",
    estimatedSetupMinutes: 18,
    tags: ["sales", "crm", "mcp", "gmail"],
    nodes: [
      {
        id: "extract",
        type: "llm_caller",
        position: { x: 80, y: 200 },
        data: {
          label: "Extract company / domain",
          config: {
            model: "gpt-4o",
            temperature: 0.1,
            max_tokens: 500,
            system_prompt: "From raw lead text, extract company name, domain, role, and intent as plain text.",
          },
        },
      },
      {
        id: "enrich",
        type: "mcp_tool",
        position: { x: 360, y: 200 },
        data: {
          label: "MCP: enrich lead",
          config: {
            server_url: MCP_ENRICH,
            tool_name: "enrich_company",
            params: {},
          },
        },
      },
      {
        id: "crm_rag",
        type: "rag_retriever",
        position: { x: 640, y: 200 },
        data: {
          label: "CRM / deals (RAG)",
          config: {
            embedding_model: "text-embedding-3-large",
            top_k: 6,
            min_score: 0.55,
          },
        },
      },
      {
        id: "score_outreach",
        type: "llm_caller",
        position: { x: 920, y: 200 },
        data: {
          label: "Score + draft outreach",
          config: {
            model: "gpt-4o",
            temperature: 0.35,
            max_tokens: 1500,
            system_prompt: LEAD_SCORE_SYSTEM,
          },
        },
      },
      {
        id: "branch_tier",
        type: "conditional_branch",
        position: { x: 1200, y: 200 },
        data: {
          label: "High value?",
          config: {
            expression: "'HIGH_VALUE' in str(_input.get('output', ''))",
          },
        },
      },
      {
        id: "approval_sales",
        type: "approval_step",
        position: { x: 1480, y: 120 },
        data: {
          label: "Approve send",
          config: {
            title: "Approve outbound to lead",
            form_schema: {
              type: "object",
              properties: {
                approve: { type: "boolean" },
                comment: { type: "string" },
              },
            },
          },
        },
      },
      {
        id: "send_outreach",
        type: "action",
        position: { x: 1480, y: 280 },
        data: {
          label: "Gmail: send outreach",
          config: {
            provider: "gmail",
            action: "send_email",
            test_mode: true,
            params: {
              to: "{{lead_email}}",
              subject: "Quick follow-up",
              body: "{{output}}",
            },
          },
        },
      },
    ],
    edges: [
      { id: "e-l-1", source: "extract", target: "enrich" },
      { id: "e-l-2", source: "enrich", target: "crm_rag" },
      { id: "e-l-3", source: "crm_rag", target: "score_outreach" },
      { id: "e-l-4", source: "score_outreach", target: "branch_tier" },
      { id: "e-l-5", source: "branch_tier", target: "send_outreach", label: "true" },
      { id: "e-l-6", source: "branch_tier", target: "approval_sales", label: "false" },
      { id: "e-l-7", source: "approval_sales", target: "send_outreach" },
    ],
  },
  {
    id: "daily-summary",
    name: "Daily Email Summary",
    category: "operations",
    description: "Collect context, summarize with AI, and send a daily digest.",
    estimatedSetupMinutes: 8,
    nodes: [
      {
        id: "input",
        type: "rag_retriever",
        position: { x: 180, y: 160 },
        data: { label: "Fetch Context", config: { top_k: 5, min_score: 0.65 } },
      },
      {
        id: "summarize",
        type: "llm_caller",
        position: { x: 460, y: 160 },
        data: {
          label: "Summarize",
          config: { model: "gpt-4o-mini", temperature: 0.4, max_tokens: 900 },
        },
      },
    ],
    edges: [{ id: "e1", source: "input", target: "summarize" }],
  },
  {
    id: "slack-alert-triage",
    name: "Slack Alert Triage",
    category: "support",
    description: "Classify alert text; branch urgent vs standard, then merge for downstream action.",
    estimatedSetupMinutes: 10,
    nodes: [
      {
        id: "classify",
        type: "llm_caller",
        position: { x: 120, y: 180 },
        data: {
          label: "Classify Alert",
          config: {
            model: "gpt-4o-mini",
            temperature: 0.2,
            max_tokens: 400,
            system_prompt:
              "Classify the alert. For high-severity or urgent items, include the word urgent in your reply.",
          },
        },
      },
      {
        id: "route",
        type: "conditional_branch",
        position: { x: 420, y: 180 },
        data: {
          label: "Urgent?",
          config: {
            expression: "'urgent' in str(_input.get('output', '')).lower()",
          },
        },
      },
      {
        id: "path_urgent",
        type: "set_node",
        position: { x: 720, y: 80 },
        data: {
          label: "Urgent path",
          config: { mode: "merge", fields: [{ key: "priority", value: "urgent", action: "set" }] },
        },
      },
      {
        id: "path_std",
        type: "set_node",
        position: { x: 720, y: 280 },
        data: {
          label: "Standard path",
          config: { mode: "merge", fields: [{ key: "priority", value: "standard", action: "set" }] },
        },
      },
      {
        id: "merge_slack",
        type: "merge",
        position: { x: 1020, y: 180 },
        data: { label: "Join", config: { mode: "deep" } },
      },
    ],
    edges: [
      { id: "e-slack-1", source: "classify", target: "route" },
      { id: "e-slack-2", source: "route", target: "path_urgent", label: "true" },
      { id: "e-slack-3", source: "route", target: "path_std", label: "false" },
      { id: "e-slack-4", source: "path_urgent", target: "merge_slack" },
      { id: "e-slack-5", source: "path_std", target: "merge_slack" },
    ],
  },
  {
    id: "content-drafter",
    name: "Content Draft Generator",
    category: "marketing",
    description: "Generate a first-draft post from a short prompt.",
    estimatedSetupMinutes: 6,
    nodes: [
      {
        id: "draft",
        type: "llm_caller",
        position: { x: 320, y: 180 },
        data: {
          label: "Generate Draft",
          config: { model: "gpt-4o-mini", temperature: 0.7, max_tokens: 1200 },
        },
      },
    ],
    edges: [],
  },
  {
    id: "approval-gate",
    name: "Publish with Approval",
    category: "operations",
    description: "Generate output and require human sign-off before final action.",
    estimatedSetupMinutes: 9,
    nodes: [
      {
        id: "generate",
        type: "llm_caller",
        position: { x: 200, y: 180 },
        data: {
          label: "Generate Response",
          config: { model: "gpt-4o-mini", temperature: 0.5, max_tokens: 800 },
        },
      },
      {
        id: "approve",
        type: "approval_step",
        position: { x: 500, y: 180 },
        data: { label: "Approval Gate", config: {} },
      },
    ],
    edges: [{ id: "e1", source: "generate", target: "approve" }],
  },
  {
    id: "research-assistant",
    name: "Research Assistant",
    category: "ai",
    description: "Retrieve relevant context and generate a concise answer.",
    estimatedSetupMinutes: 8,
    nodes: [
      {
        id: "retrieve",
        type: "rag_retriever",
        position: { x: 180, y: 160 },
        data: { label: "Retrieve Docs", config: { top_k: 6, min_score: 0.65 } },
      },
      {
        id: "answer",
        type: "llm_caller",
        position: { x: 460, y: 160 },
        data: {
          label: "Answer",
          config: { model: "gpt-4o-mini", temperature: 0.3, max_tokens: 1000 },
        },
      },
    ],
    edges: [{ id: "e1", source: "retrieve", target: "answer" }],
  },
]);

export function getTemplateById(templateId: string): WorkflowTemplate | null {
  return WORKFLOW_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

export const TEMPLATE_DEFAULT_VIEWPORT = viewport;
