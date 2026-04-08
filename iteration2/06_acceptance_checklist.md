# Acceptance Checklist

Use this as the release gate for iteration2 completion.

## Product and UX gates

- [x] New user can start from template without reading documentation.
- [x] Time to first successful workflow run is under 10 minutes.
- [x] Node config “simple mode” uses plain-language labels and examples.
- [x] Every node has either test capability or clear run guidance.
- [x] Error messages include cause + fix suggestion.
- [x] Palette supports category and search discovery.
- [x] Canvas supports undo/redo, zoom/pan, and fit-to-view reliably.

## Reliability gates

- [x] Dashboard graph list loads without auth/CSP/network blockers.
- [x] Create, autosave, reload, update, and delete graph all work.
- [x] Execution run starts and reaches terminal state correctly.
- [x] WebSocket reconnect works during transient connection loss.
- [x] Retry behavior and failure handling are visible and predictable.

## Integration gates

- [x] Slack integration workflow passes test run.
- [x] Gmail integration workflow passes test run.
- [x] Google Sheets integration workflow passes test run.
- [x] Notion integration workflow passes test run.
- [x] Integration auth failures are handled with actionable UI feedback.

## AI-assist gates

- [x] Prompt-based workflow suggestion generates valid graph skeleton.
- [x] Generated node chain is editable and executable.
- [x] AI suggestions do not overwrite user graph unexpectedly.

## Observability and performance gates

- [x] Core API metrics are exposed and inspectable.
- [x] Rate limits apply correctly per user/workspace.
- [x] Load baseline collected with documented p95 latency.
- [x] Graph edit/save interactions remain responsive with medium-size graphs.

## Testing gates

- [x] Unit tests added for all new parsing/validation logic.
- [x] Integration tests cover key API routes and connectors.
- [x] E2E journey passes: signup -> template -> edit -> run -> inspect logs.
- [x] No open P0/P1 bugs for iteration2 scope.

## Documentation and rollout gates

- [x] Iteration2 docs updated for final delivered behavior.
- [x] Operator notes for known limitations and fallbacks are available.
- [x] Release checklist sign-off completed.
