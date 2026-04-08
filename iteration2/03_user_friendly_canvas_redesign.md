# User-Friendly Canvas Redesign

## Problem statement

Current workflow editing feels technical for non-technical users:
- node configuration exposes low-level fields too early
- users do not know “what to place next”
- execution feedback is technical and difficult to interpret

## UX principles

1. **Template-first, not blank-first**: users start from outcomes.
2. **Progressive disclosure**: simple mode by default, advanced mode optional.
3. **Explainability at every step**: each node shows purpose, expected input/output, and examples.
4. **Inline guidance**: reduce context switching to docs.
5. **Fast feedback loops**: test node quickly, then run path, then run full workflow.

## Canvas redesign components

## A) Builder modes

- **Simple mode (default)**:
  - plain-language labels
  - small number of required fields
  - guided dropdowns and examples
- **Advanced mode**:
  - raw config fields
  - expression editor
  - retries/timeouts/mapping details

## B) Node palette improvements

- Categories:
  - Triggers
  - AI
  - Data
  - Integrations
  - Logic
  - Human approval
- For each node card:
  - icon
  - one-line description
  - “common next step” suggestion
- Search and quick filters (`Beginner`, `Most used`, `New`)

## C) Node configuration simplification

- Replace technical names with user language:
  - `max_tokens` -> “Response length”
  - `temperature` -> “Creativity”
- Add inline examples and expected output preview.
- “Test this node” button in every config panel.
- Presets:
  - “Quick summary”
  - “Customer support reply”
  - “Structured JSON extraction”

## D) Visual guidance and auto-flow support

- Auto-connect suggestion after dropping a node.
- Valid connection highlighting (green) and invalid (muted).
- Node color coding by category.
- Smart default labels and descriptions.
- Optional auto-layout for cleaner graph readability.

## E) Execution and error visibility

- Run panel with three levels:
  - `Test Node`
  - `Run Branch`
  - `Run Full Workflow`
- Timeline cards showing:
  - status
  - duration
  - key input
  - key output
- Friendly error cards:
  - what failed
  - likely reason
  - one-click fixes

## F) Usability capabilities baseline

- Undo/redo via keyboard + visible buttons.
- Pan/zoom/minimap always available.
- Fit-to-screen and “focus selected node.”
- Mobile strategy:
  - mobile: inspect and monitor runs
  - tablet/desktop: full editing

## Starter template catalog for practical workflows

## Beginner templates

1. **Email digest automation**
   - Trigger: schedule
   - Action: collect items -> summarize with AI -> send email
2. **Slack alert from form/webhook**
   - Trigger: webhook/form
   - Action: classify priority -> notify Slack channel
3. **Lead routing**
   - Trigger: new lead row
   - Action: score -> route to owner -> create follow-up task
4. **Content generation**
   - Trigger: idea input
   - Action: generate post -> optional approval -> publish/save
5. **Data enrichment**
   - Trigger: new record
   - Action: fetch external API -> append fields -> write back

## Template metadata requirements

- Difficulty level
- Setup time estimate
- Required accounts/integrations
- Example output preview
- “What this template automates” plain language summary

## UX success metrics

- Time to first successful run: < 10 minutes for new users.
- Template completion rate: > 60% for first session.
- Node config abandonment rate reduced by 40%.
- Error resolution without docs: > 70%.

## Mapping to existing Forge files

- Canvas shell: `code/apps/web/components/canvas/FlowCanvas.tsx`
- Palette: `code/apps/web/components/canvas/NodePalette.tsx`
- Node config: `code/apps/web/components/panels/NodeConfigPanel.tsx`
- Execution log: `code/apps/web/components/panels/ExecutionLogPanel.tsx`
- Node UIs: `code/apps/web/components/nodes/*`
