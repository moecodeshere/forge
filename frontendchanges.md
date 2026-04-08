## n8n‑style Canvas Frontend – Change Plan

### 1. Global layout & theme
- **Adopt n8n canvas shell**: full‑height flex layout with three main regions: left navigation rail, central canvas area, bottom logs bar.
- **Color system**: lock to dark palette very close to n8n (background `#050509`–`#111827`, panels `#111111`–`#18181b`, borders `#27272f`, primary accent `#f97316`/`#f97316`‑style orange for Execute, secondary accents `#22c55e` and `#6366f1`).
- **Typography**: base font size 13–14px, compact line heights, uppercase micro‑labels for tabs and badges.

### 2. Left navigation rail
- **Replace current rail implementation** in `FlowCanvas.tsx` with a strict clone of n8n’s:
  - Top: product logo, workspace selector / breadcrumb row.
  - Primary items: `Overview`, `Personal`, `Chat (beta)` using the same icon + label spacing and active background.
  - Secondary group at bottom: `Admin Panel`, `Templates`, `Insights`, `Help`, `Settings`, each with the same hover and active styles.
- **Wire navigation** so every item routes to a real page (even if some are simple placeholder screens for now).

### 3. Top canvas header
- **Add canvas header bar** above the graph inside `FlowCanvas`:
  - Left: breadcrumb `Workspace / Workflow Name` + optional tag chip.
  - Center tabs: `Editor`, `Executions`, `Evaluations` (tabbed state stored in React state).
  - Right: compact controls mirroring n8n (execution count badge, `Publish` dropdown, run history icon, overflow menu).
- Ensure header sticks to the top of the canvas and does not scroll with the graph.

### 4. Central canvas controls
- **Replace current bottom‑left control strip** with vertical n8n‑style controls on the right:
  - Stack of icon buttons (`+` node creator, zoom in/out, fit view, “re‑center”, AI/assistant shortcut) rendered as a floating column on the right edge.
  - Keep small square buttons with subtle border and hover elevation.
- **Execute button**: keep a single orange “Execute workflow” button centered at the very bottom of the canvas (above logs), matching n8n’s size, radius, and color.

### 5. Node configuration & AI assistant panel
- **Node drawer**: refine the existing floating `NodeConfigPanel` so it matches n8n’s right‑hand side drawer:
  - Fixed width, full height minus header/logs, right‑docked with slide‑in animation.
  - Header row with node icon, node name, close button.
  - Internals: reuse our existing config form but apply tighter padding, `border-b` sections, and scrollable body.
- **Future AI assistant panel**: reserve space and layout pattern on the right for an AI “helper” panel (like n8n AI) that can show:
  - Suggestions list (cards with icon + text).
  - “Execute and refine” and “Notify me” buttons.
  - This can initially be static / stub content wired to our existing AI nodes.

### 6. Logs bar
- **Bottom logs bar**: keep `ExecutionLogPanel` but restyle to match n8n’s Logs strip:
  - Fixed 72–80px height with `Logs` label left, three‑dot menu right.
  - When logs exist, show them in an expandable area just above the bar, not as large cards.
  - Maintain our existing structured data (timeline, LLM output) but surface them in a slimmer list.

### 7. Canvas background & node styling
- **Background**: switch to n8n‑style dot/stripe hybrid:
  - Dark diagonal stripes overlay with a subtle dot grid (use CSS background layers or custom `Background` component props).
- **Nodes**: update React Flow node components to:
  - Use pill‑shaped node bodies, icon on left, label on right, status badges (error, working…) similar to n8n.
  - Add hover and selection outlines consistent with the new color system.

### 8. Interactions & shortcuts
- **Keyboard shortcuts**: match key n8n shortcuts where possible (zoom, delete node, run workflow) and show hints in tooltips.
- **Transitions**: add small CSS transitions (opacity/transform) for:
  - Opening/closing node drawer.
  - Hover on nav items, buttons, and nodes.

### 9. Testing, cleanup & alignment
- Vitest suite for `apps/web` runs clean after the canvas and node UX changes; use it as a guardrail for future edits.
- The node catalog lives in `code/apps/web/lib/nodes/catalog.ts` and is consumed by `NodePalette` and templates under `lib/templates/workflows.ts`.
- Layout ownership:
  - `FlowCanvas.tsx` — shell, header, canvas controls, drawers, and logs container.
  - `ExecutionLogPanel.tsx` — bottom Logs bar styling and content.
  - `NodeConfigPanel.tsx` — per-node configuration forms, simple/advanced modes.
  - `NodePalette.tsx` — overlay palette backed by `NODE_CATALOG`.
- To add a new node end‑to‑end:
  1. Implement a backend plugin with `NodePluginMeta` in `app/services/nodes/`.
  2. Add a matching entry in `NODE_CATALOG`.
  3. Add simple‑mode config fields in `NodeConfigPanel` if needed.
  4. Optionally include the node in one or more workflow templates.
- Periodically capture screenshots and compare against n8n for:
  - Spacing, font sizes, and hover states.
  - Behavior of Execute, Logs, and drawers.
  - Ease of configuring each core node with minimal required input.

