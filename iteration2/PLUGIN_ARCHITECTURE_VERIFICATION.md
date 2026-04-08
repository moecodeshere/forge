# Plugin Architecture Verification Guide

This document describes how to verify that the Forge Plugin-Based Node Architecture was implemented correctly after the refactor.

## Quick Verification Commands

Run these from `code/`:

```bash
# 1. API tests (all must pass) — 47 tests
cd apps/api && source .venv/bin/activate && pytest tests/ -v --ignore=tests/e2e

# 2. Nodes API test (checks plugin registration)
cd apps/api && pytest tests/test_nodes_router.py -v

# 3. List registered node plugins via API (requires API running)
curl -s http://localhost:8000/nodes | jq '.[].type'

# 4. Release gate (full suite)
./scripts/release_gate.sh
```

## How to Check What Was Implemented

1. **API tests** — Run `pytest tests/ -v --ignore=tests/e2e`; all 47 tests should pass.
2. **Plugin registry** — Start the API and `curl http://localhost:8000/nodes`; response should include types like `manual_trigger`, `webhook_trigger`, `llm_caller`, `http_request`, `simple_llm`, `set_node`, etc.
3. **Execution** — Tests in `test_execution.py` verify graph execution uses the plugin registry.
4. **Release gate** — Run `./scripts/release_gate.sh` from `code/`; includes API tests, web lint, and other checks.

## What Was Implemented

### Backend (API)

| Component | Location | Verification |
|-----------|----------|--------------|
| Node plugin base | `app/services/nodes/base.py` | `NodePluginMeta`, `ExecutionContext`, `NodePlugin` protocol |
| Registry | `app/services/nodes/registry.py` | `get_plugin()`, `list_plugins()`, `register()` |
| Plugins | `app/services/nodes/*.py` | `llm_caller`, `rag_retriever`, `conditional_branch`, `mcp_tool`, `approval_step`, `manual_trigger`, `webhook_trigger`, `simple_llm`, `http_request`, `set_node` |
| Execution dispatch | `app/services/execution.py` | Uses `get_plugin(node_type)` instead of if/elif |
| Expression engine | `app/services/expressions.py` | `evaluate_expression("{{input.x}}", context)` |
| Approval gates | `app/services/approval_gates.py` | Extracted from execution for no circular imports |
| GET /nodes | `app/routers/nodes.py` | Returns plugin metadata |
| DAG trigger validation | `app/services/dag_validator.py` | `validate_has_single_trigger()` |
| Workflow webhook | `app/routers/webhooks.py` | `POST /webhooks/workflow/{graph_id}` |
| Code export | `app/services/deploy/code_export.py` | Registry-aware, supports new node types |
| MCP deploy | `app/services/deploy/mcp_deploy.py` | Includes `simple_llm` in manifest |

### Frontend (Web)

| Component | Location | Verification |
|-----------|----------|--------------|
| Node palette | `components/canvas/NodePalette.tsx` | Categories: Triggers, AI, Actions, Data, Logic, Flow, Human |
| New node components | `components/nodes/*.tsx` | `ManualTriggerNode`, `WebhookTriggerNode`, `HttpRequestNode`, `SimpleLLMNode`, `SetNode` |
| FlowCanvas | `components/canvas/FlowCanvas.tsx` | `nodeTypes` map includes all new types |
| NodeConfigPanel | `components/panels/NodeConfigPanel.tsx` | Config UI for manual_trigger, webhook_trigger, simple_llm, http_request, set_node |
| Graph store | `lib/stores/graphStore.ts` | `ForgeNodeType` includes all new types |
| Shared schemas | `packages/shared-schemas/src/nodes.ts` | `NodeTypeSchema` includes all new types |

## Manual Verification Steps

1. **Start API and Web**
   ```bash
   cd code/apps/api && uvicorn app.main:app --reload
   cd code/apps/web && pnpm dev
   ```

2. **Check GET /nodes**
   - Visit `http://localhost:8000/nodes` (or with auth if required)
   - Should return JSON array of plugin metadata with `type`, `category`, `label`, `config_schema`

3. **Canvas**
   - Open a workflow canvas
   - Node palette should show categories: Triggers, AI, Actions, Data, Logic, Flow, Human
   - Drag Manual Trigger, Simple LLM, HTTP Request, Set nodes onto canvas
   - Select each node and verify config panel shows correct fields

4. **Execution**
   - Create workflow: Manual Trigger -> LLM Caller (or Simple LLM)
   - Click Run; verify execution completes and events stream

5. **Webhook**
   - Create workflow with Webhook Trigger as first node
   - `curl -X POST http://localhost:8000/webhooks/workflow/{graph_id} -H "Content-Type: application/json" -d '{"test":"data"}'`
   - Should return `{"run_id":"...", "status":"accepted"}`

6. **DAG validation**
   - Try creating a graph with two source nodes (two nodes with no incoming edges)
   - Save should fail with "Graph must have exactly one trigger"

## Known Non-Blocking Issues

- **Web build font fetch**: `pnpm run build` may fail in sandbox/offline due to Google Fonts fetch. Use `pnpm dev` for local development.
- **Sentry TS**: `@sentry/nextjs` type errors if not installed; does not affect runtime.
