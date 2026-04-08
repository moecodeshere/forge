# Research Summary

## Objective

Compare Forge against mature automation/workflow tools and extract concrete product and UX lessons.

## Tool comparison matrix (core)

| Dimension | n8n | Zapier | Forge learning |
|---|---|---|---|
| Primary user | Technical and semi-technical builders | Non-technical and business teams | Support both with beginner/simple and advanced modes |
| Workflow model | Node graph with optional code nodes | Trigger-action chains with branching | Keep node graph, but guide users with scenario templates |
| Triggers | Webhook, schedule, app events | Very broad app triggers, polling and event triggers | Build first-class trigger library (`Manual`, `Schedule`, `Webhook`, app triggers) |
| Actions | Rich integration actions, transform/code steps | Massive action catalog across SaaS apps | Prioritize high-frequency actions first (message, write row, create ticket) |
| Error handling | Retries, error workflow, execution logs | Task history, alerts, simple rerun | Add retry policies + in-canvas remediation suggestions |
| Hosting | Cloud and self-host | Mostly cloud | Maintain self-host + managed cloud as a strategic differentiator |
| Governance | Growing RBAC/projects | Strong team/admin controls on paid plans | Add role model, approvals, audit trails for team adoption |
| AI support | Agent and AI-oriented nodes | Copilot-like assistant and AI steps | Add AI workflow generation + node param autofill |
| Pricing approach | Usage/execution based | Task-based tiering | Expose usage meter in-product to reduce billing surprise |

## Node/input and UX patterns

| Pattern | n8n | Zapier | Recommendation for Forge |
|---|---|---|---|
| Config experience | Powerful, sometimes technical | Form-first, beginner-friendly | Replace raw technical fields with guided forms and examples |
| Data mapping | Expression editor and references | Easier mapping UX with suggestions | Add “insert output from previous step” picker |
| Validation | Good but often late | Clear step-level validation | Validate live while editing each field |
| Debugging | Detailed run logs and payloads | Task history with errors | Add run timeline + node-by-node input/output preview |
| Reusability | Templates and shared workflows | Template marketplace and copies | Build curated starter template catalog by use case |

## Integrations and ecosystem

| Category | n8n | Zapier | Forge priority |
|---|---|---|---|
| Collaboration/chat | Slack, Teams | Slack, Teams, many chat apps | Slack first, then Teams |
| Productivity suites | Google, Notion, Airtable | Google Workspace deep coverage | Google Sheets/Gmail/Drive early |
| CRM/Sales | HubSpot, Salesforce | Strong CRM coverage | HubSpot first for SMB workflow value |
| Databases | Postgres/MySQL/Mongo and HTTP | Strong SaaS connectors, fewer deep DB workflows | Postgres/MySQL and generic SQL connector |
| AI providers | Multiple LLM and vector options | AI steps and model wrappers | Unified AI node with provider abstraction |

## Setup and commercial positioning

| Topic | n8n | Zapier | Forge implication |
|---|---|---|---|
| Onboarding | Template and workflow examples | Fast “connect app -> test” onboarding | Add “build first workflow in 5 minutes” guided path |
| Marketplace | Templates/community nodes | Extensive integration ecosystem | Build template + node marketplace progressively |
| Pricing psychology | Technical teams optimize cost with self-host | Convenience and breadth premium | Offer freemium + transparent run/task usage dashboard |

## Strengths and weaknesses to learn from

### n8n strengths to copy
- Flexible graph architecture with clear execution traces.
- Strong self-host story for privacy-sensitive teams.
- Good “escape hatch” for advanced users.

### n8n weaknesses to avoid
- Can overwhelm non-technical users with technical fields.
- Configuration depth can slow first-time success.

### Zapier strengths to copy
- Extremely low-friction onboarding and app connection.
- Very clear language around triggers, actions, and paths.
- Strong template-led activation.

### Zapier weaknesses to avoid
- Less transparent behavior on complex branching/cost at scale.
- Limited visual graph expressiveness compared with full canvas workflows.

## Additional inspiration: Make.com, Node-RED, Retool

| Tool | UX/canvas ideas worth adopting | Risks to avoid |
|---|---|---|
| Make.com | Visual routers, iterators, aggregators, rich path debugging | Visual clutter with large scenarios |
| Node-RED | Fast flow authoring, huge node ecosystem, subflows | Too developer-oriented for business users |
| Retool Workflows | Strong ops/debug perspective, enterprise controls | Can become code-heavy and less no-code friendly |

## Key conclusions for Forge

1. Start with a template-first beginner experience, not empty-canvas-only.
2. Keep advanced power, but hide it behind progressive disclosure.
3. Build first-class execution observability (timeline, I/O snapshots, retries).
4. Prioritize integration depth over breadth in early iterations.
5. Treat collaboration/governance as core, not “later,” for team adoption.
