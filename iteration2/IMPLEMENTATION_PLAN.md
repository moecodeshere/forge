# Forge Platform Improvement Plan

**Date:** March 13, 2026  
**Scope:** Fix workflow loading, improve usability, refine nodes, add node types, simplify configuration

---

## Executive Summary

This plan addresses five core issues:

1. **Workflows not loading** — Dashboard shows skeletons/empty instead of user workflows
2. **Platform not usable** — General UX friction
3. **Nodes not refined** — Node visuals and behavior need polish
4. **Not enough nodes** — Expand node catalog
5. **Difficult to adjust** — Node configuration is cumbersome

---

## Phase A: Fix Workflow Loading (Priority: P0)

**Goal:** Dashboard reliably loads and displays user workflows.

### Root Cause Analysis

| Possible Cause | Check | Fix |
|----------------|-------|-----|
| Auth session missing | `listGraphs` throws before fetch | Ensure user is redirected to login when unauthenticated |
| API unreachable | CORS, wrong URL, API down | Add retry, clear error message, health check |
| API returns wrong format | Response shape mismatch | Defensive parsing, handle `items` vs `data` |
| `json_content` structure | `graph.json_content.nodes` undefined | Use optional chaining: `graph.json_content?.nodes?.length ?? 0` |
| Create validation blocks save | DAG/trigger validation fails on new graphs | Allow empty/minimal graphs for first save |

### Tasks

1. **A1. Defensive dashboard parsing**
   - Use `graph.json_content?.nodes?.length ?? 0` and `graph.description ?? "No description"`
   - Handle malformed API responses without crashing

2. **A2. Auth-aware loading**
   - If `listGraphs` throws "Missing user session", redirect to `/login?next=/dashboard`
   - Show "Sign in to see your workflows" when unauthenticated

3. **A3. Better error UX**
   - Distinguish: "API unreachable" vs "Auth required" vs "No workflows yet"
   - Add "Retry" button on error
   - Show loading timeout after 10s with "Taking longer than usual" message

4. **A4. Relax create validation for new graphs**
   - Allow creating graphs with empty nodes (or single trigger) for "New Graph" flow
   - Validate DAG only when saving non-empty graphs

---

## Phase B: Platform Usability (Priority: P0)

**Goal:** Make the platform feel responsive, predictable, and easy to navigate.

### Tasks

1. **B1. Canvas onboarding**
   - First-time canvas: short tooltip tour (nodes, edges, run, save)
   - "Add your first node" prompt when canvas is empty

2. **B2. Keyboard shortcuts**
   - `Ctrl/Cmd+S` — Save
   - `Ctrl/Cmd+Enter` — Run
   - `Delete` — Delete selected node
   - `Escape` — Deselect

3. **B3. Undo/Redo visibility**
   - Show undo/redo buttons in header or toolbar
   - Display "Unsaved" / "Saving…" / "Saved" clearly

4. **B4. Responsive sidebar**
   - Node config panel: collapsible on small screens
   - Node palette: search/filter by name

5. **B5. Run feedback**
   - Clear "Running…" state with progress indicator
   - Success/failure toast or inline message

---

## Phase C: Node Refinement (Priority: P1)

**Goal:** Nodes look professional, are easy to identify, and behave consistently.

### Tasks

1. **C1. Visual polish**
   - Consistent node sizing (min-width, max-width)
   - Category-based color coding (Triggers=blue, AI=purple, Actions=green, etc.)
   - Clear icons per node type in the node header
   - Subtle shadow/border for depth

2. **C2. Node preview**
   - Show key config in subtitle (e.g. "gpt-4o-mini • 0.7 temp" for LLM)
   - HTTP node: show method + truncated URL
   - Set node: show "N fields" or first field key

3. **C3. Connection UX**
   - Highlight valid connection targets on drag
   - Show "Add next" affordance more prominently
   - Disable invalid connections (e.g. trigger → trigger)

4. **C4. Node palette improvements**
   - Group by category with collapsible sections
   - Search/filter nodes by name
   - "Beginner friendly" badge on simple nodes

---

## Phase D: More Node Types (Priority: P1)

**Goal:** Expand the node catalog so users can build richer workflows.

### New Nodes to Add

| Node | Category | Description | Backend | Frontend |
|------|----------|-------------|---------|----------|
| **Delay** | Flow | Pause execution for N seconds | New plugin | New component |
| **Loop** | Flow | Iterate over array, run subgraph per item | New plugin | New component |
| **Code** | Data | Run inline Python/JS snippet | New plugin | New component |
| **JSON Parse** | Data | Parse JSON string to object | New plugin | New component |
| **JSON Stringify** | Data | Serialize object to JSON | New plugin | New component |
| **Filter** | Logic | Filter array by expression | New plugin | New component |
| **Merge** | Data | Merge multiple inputs into one | New plugin | New component |
| **Slack Message** | Actions | Post to Slack (simplified MCP) | Use MCP or new | New component |
| **Send Email** | Actions | Send email via SMTP/SendGrid | New plugin | New component |
| **Database Query** | Actions | Run SQL query (Supabase) | New plugin | New component |

### Implementation Order

1. **Delay** — Simple, high value for scheduled flows
2. **JSON Parse / Stringify** — Common data ops
3. **Merge** — Combine multiple branches
4. **Filter** — Array operations
5. **Code** — Flexible but needs sandbox
6. **Loop** — Complex, defer to later phase

---

## Phase E: Easier Node Configuration (Priority: P0)

**Goal:** Configure nodes without fighting the UI.

### Tasks

1. **E1. Set node — full config UI**
   - Replace "Configure fields in advanced mode" with:
     - Add/remove field rows
     - Each row: key, value, action (set/remove/rename)
     - Rename: key + rename_to
   - Simple mode: key-value pairs
   - Advanced: JSON editor fallback

2. **E2. Conditional branch — node picker**
   - Replace "Target Node Id" text input with dropdown of valid target nodes
   - Show expression builder with common operators (equals, contains, >, <)

3. **E3. LLM nodes — prompt templates**
   - Larger textarea for system/user prompt
   - Variable chips: `{{input.query}}`, `{{node_id.output}}`
   - Insert variable button

4. **E4. HTTP Request — improved UX**
   - URL with placeholder examples
   - Headers as key-value list (add/remove rows)
   - Body: toggle JSON / form-data
   - "Test request" button (optional)

5. **E5. Schedule trigger — presets**
   - Presets: "Every hour", "Daily at 9am", "Weekly Monday"
   - Map to cron/interval under the hood

6. **E6. MCP tool — simplify**
   - Reduce Integration vs MCP server toggle confusion
   - Tool picker when server URL is known (fetch tools list)
   - Clearer "Test mode" explanation

---

## Implementation Order

| Phase | Priority | Est. Effort | Dependencies |
|-------|----------|-------------|--------------|
| **A** (Workflow loading) | P0 | 0.5–1 day | None |
| **E** (Node config) | P0 | 1–2 days | None |
| **B** (Usability) | P0 | 1 day | A |
| **C** (Node refinement) | P1 | 1 day | B |
| **D** (More nodes) | P1 | 2–3 days | C, E |

### Recommended Sprint 1 (Week 1)

1. A1–A4: Fix workflow loading
2. E1: Set node full config UI
3. E2: Conditional branch node picker
4. B1–B3: Canvas onboarding, shortcuts, save indicator

### Recommended Sprint 2 (Week 2)

1. E3–E6: Remaining config improvements
2. B4–B5: Sidebar, run feedback
3. C1–C2: Node visual polish and preview

### Recommended Sprint 3 (Week 3+)

1. C3–C4: Connection UX, palette improvements
2. D: New nodes (Delay, JSON Parse/Stringify, Merge, Filter)

---

## Files to Modify

### Phase A
- `code/apps/web/app/dashboard/page.tsx`
- `code/apps/web/lib/api/graphs.ts`
- `code/apps/api/app/routers/graphs.py` (validation)
- `code/apps/web/middleware.ts` (auth redirect)

### Phase B
- `code/apps/web/components/canvas/FlowCanvas.tsx`
- `code/apps/web/app/dashboard/page.tsx`
- `code/apps/web/lib/contexts/CanvasActionsContext.tsx`

### Phase C
- `code/apps/web/components/nodes/BaseNode.tsx`
- `code/apps/web/components/nodes/*.tsx` (each node)
- `code/apps/web/components/canvas/NodePalette.tsx`

### Phase D
- `code/apps/api/app/services/nodes/` (new plugins)
- `code/apps/web/lib/nodes/catalog.ts`
- `code/apps/web/components/nodes/` (new components)

### Phase E
- `code/apps/web/components/panels/NodeConfigPanel.tsx`
- `code/apps/web/components/nodes/SetNode.tsx` (if separate)

---

## Success Criteria

- [ ] Dashboard loads user workflows within 3s or shows clear error
- [ ] New user can create, configure, run, and see a workflow in &lt; 5 min
- [ ] Set node configurable without editing JSON
- [ ] Conditional branch uses node picker, not raw IDs
- [ ] At least 4 new node types (Delay, JSON Parse, JSON Stringify, Merge)
- [ ] Node palette searchable and categorized
- [ ] Keyboard shortcuts for Save and Run
