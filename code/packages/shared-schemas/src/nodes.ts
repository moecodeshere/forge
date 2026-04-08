/**
 * Zod schemas for all Forge node types.
 * These are the source of truth — Pydantic models are generated from these.
 * See codegen/generate_pydantic.py
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const NodeIdSchema = z.string().uuid();

export const NodeTypeSchema = z.enum([
  "manual_trigger",
  "webhook_trigger",
  "schedule_trigger",
  "form_submission_trigger",
  "app_event_trigger",
  "ai_agent",
  "llm_caller",
  "simple_llm",
  "rag_retriever",
  "conditional_branch",
  "mcp_tool",
  "http_request",
  "set_node",
  "approval_step",
]);

export type NodeType = z.infer<typeof NodeTypeSchema>;

// ---------------------------------------------------------------------------
// 1. LLM Caller
//    inputs: text, context[]  |  outputs: text, tool_calls[]
// ---------------------------------------------------------------------------

export const LLMModelSchema = z.enum([
  "gpt-4o",
  "gpt-4o-mini",
  "claude-3-5-sonnet-20241022",
  "claude-3-haiku-20240307",
  "gemini-2.0-flash",
  "gemini-1.5-pro",
]);

export type LLMModel = z.infer<typeof LLMModelSchema>;

export const LLMCallerConfigSchema = z.object({
  model: LLMModelSchema,
  temperature: z.number().min(0).max(1).default(0.7),
  max_tokens: z.number().int().positive().max(8192).default(2048),
  system_prompt: z.string().max(4096).optional(),
  stream: z.boolean().default(true),
});

export type LLMCallerConfig = z.infer<typeof LLMCallerConfigSchema>;

// ---------------------------------------------------------------------------
// 2. RAG Retriever
//    inputs: query  |  outputs: documents[]
// ---------------------------------------------------------------------------

export const EmbeddingModelSchema = z.enum([
  "text-embedding-3-small",
  "text-embedding-3-large",
  "all-MiniLM-L6-v2",
]);

export const RAGRetrieverConfigSchema = z.object({
  embedding_model: EmbeddingModelSchema.default("text-embedding-3-small"),
  top_k: z.number().int().positive().max(20).default(5),
  min_score: z.number().min(0).max(1).default(0.65),
  collection_id: z.string().uuid().optional(),
});

export type RAGRetrieverConfig = z.infer<typeof RAGRetrieverConfigSchema>;

// ---------------------------------------------------------------------------
// 3. Conditional Branch
//    inputs: value  |  outputs: branch_id (string)
// ---------------------------------------------------------------------------

export const ConditionSchema = z.object({
  id: z.string().uuid(),
  expr: z.string().min(1).max(512),
  target: z.string().min(1),
  label: z.string().optional(),
});

export type Condition = z.infer<typeof ConditionSchema>;

export const ConditionalBranchConfigSchema = z.object({
  conditions: z.array(ConditionSchema).min(1).max(20),
  default_target: z.string().optional(),
});

export type ConditionalBranchConfig = z.infer<typeof ConditionalBranchConfigSchema>;

// ---------------------------------------------------------------------------
// 4. MCP Tool
//    inputs: dynamic (from tool schema)  |  outputs: dynamic result
// ---------------------------------------------------------------------------

export const MCPAuthTypeSchema = z.enum(["none", "oauth2", "jwt", "api_key"]);

export const MCPToolConfigSchema = z.object({
  mcp_url: z.string().url().max(512),
  tool_name: z.string().min(1).max(128),
  auth_type: MCPAuthTypeSchema.default("none"),
  auth_config: z.record(z.string()).optional(),
  timeout_ms: z.number().int().positive().max(30_000).default(10_000),
});

export type MCPToolConfig = z.infer<typeof MCPToolConfigSchema>;

// ---------------------------------------------------------------------------
// 5. Approval Step
//    inputs: request_data  |  outputs: { approved: boolean, feedback: string }
// ---------------------------------------------------------------------------

export const ApprovalStepConfigSchema = z.object({
  title: z.string().min(1).max(128).default("Review Required"),
  description: z.string().max(512).optional(),
  form_schema: z.record(z.unknown()).optional(),
  timeout_hours: z.number().int().positive().max(168).default(24),
  notify_email: z.string().email().optional(),
});

export type ApprovalStepConfig = z.infer<typeof ApprovalStepConfigSchema>;

// ---------------------------------------------------------------------------
// 6. AI Agent
//    inputs: context  |  outputs: result (text or JSON)
// ---------------------------------------------------------------------------

export const AiAgentConfigSchema = z.object({
  model: LLMModelSchema.default("gpt-4o-mini"),
  system_prompt: z.string().max(4096).optional(),
  tools: z.array(z.string()).default([]),
  memory_source: z.string().optional(),
  output_mode: z.enum(["text", "json"]).default("text"),
});

export type AiAgentConfig = z.infer<typeof AiAgentConfigSchema>;

// ---------------------------------------------------------------------------
// Union: all node config types
// ---------------------------------------------------------------------------

export const NodeConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("llm_caller"), config: LLMCallerConfigSchema }),
  z.object({ type: z.literal("rag_retriever"), config: RAGRetrieverConfigSchema }),
  z.object({ type: z.literal("conditional_branch"), config: ConditionalBranchConfigSchema }),
  z.object({ type: z.literal("mcp_tool"), config: MCPToolConfigSchema }),
  z.object({ type: z.literal("approval_step"), config: ApprovalStepConfigSchema }),
  z.object({ type: z.literal("ai_agent"), config: AiAgentConfigSchema }),
]);

export type NodeConfig = z.infer<typeof NodeConfigSchema>;
