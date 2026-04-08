# Expanded Scope

## Product direction

Forge should evolve from a technical node editor into a beginner-friendly automation platform with strong execution reliability and gradual power features.

## Feature expansion

## 1) AI-assisted building

- AI workflow generator: user enters intent in natural language, Forge scaffolds nodes and connections.
- Node suggestion engine: propose likely next node based on graph context.
- Parameter autofill: suggest defaults and examples from selected integration/model.
- Error explanation assistant: translate technical failures into “what happened / how to fix.”

## 2) Template ecosystem

- Starter templates (beginner): email summaries, lead alerts, content generation, data sync.
- Role templates (business): marketing, operations, support, founder toolkit.
- Industry templates: ecommerce, SaaS, agencies.
- Template metadata: setup time, required accounts, expected outcome preview.

## 3) Collaboration and team workflow

- Shared workspaces and role-based permissions.
- Inline comments on nodes/edges and mentions.
- Approval assignment queue with SLA and ownership.
- Version history and compare/restore workflow revisions.

## 4) Execution and operational maturity

- Visual run timeline with node timing and payload snapshots.
- Retry policy editor (linear/exponential/custom attempts).
- Partial rerun from failed node.
- Alerting hooks (email/slack/webhook) on failure or SLA breach.

## 5) Developer and pro-user power

- Reusable subflows and custom node packs.
- Environment variables per workspace/environment.
- Promotion flow: dev -> staging -> production workflow versions.
- API-first publish and run endpoints for external apps.

## Integration expansion plan

## Tier 1 (must-have)

- Slack
- Gmail
- Google Sheets
- Google Drive
- Notion
- Webhook trigger
- HTTP request

## Tier 2 (high-value next wave)

- HubSpot
- Airtable
- GitHub
- Stripe
- PostgreSQL / MySQL connectors

## Tier 3 (ecosystem growth)

- Zendesk / Intercom
- Jira / Linear
- Salesforce
- Shopify / WooCommerce

## AI and model integrations

- Unified `LLM` node with provider switch:
  - OpenAI
  - Anthropic
  - Google Gemini
- Optional model routing policy:
  - cost-optimized
  - latency-optimized
  - quality-optimized

## Scalability and performance scope

## Canvas scalability

- Virtualized rendering for large graphs (100-500 nodes).
- Grouping and collapsible sections to reduce visual overload.
- Auto-layout and “tidy graph” actions.
- Connection minimization tools (edge routing clarity).

## Execution scalability

- Queue-based execution with concurrency limits per workspace.
- Redis-backed event fan-out and resilient reconnect for live logs.
- Node-level caching for deterministic steps.
- Rate-limits and backpressure rules for expensive integrations.

## Data and observability scope

- Execution metadata retention policies.
- Searchable run history and failure trend analytics.
- SLO dashboards: save latency, run success rate, mean time to recovery.

## Monetization scope

## Packaging model

- Free: limited monthly runs, core nodes, public templates.
- Pro: higher run limits, premium nodes, scheduling, retries, private templates.
- Team: collaboration, RBAC, approvals, audit logs.
- Enterprise: SSO/SAML, governance controls, dedicated support, advanced limits.

## Marketplace model

- Paid template marketplace with creator revenue sharing.
- Premium integration packs and vertical template bundles.
- Usage-based overage for runs beyond included quotas.

## Scope boundaries for this iteration

- Do not attempt full integration breadth at once.
- Prioritize activation and reliability before enterprise extras.
- Keep one-developer execution feasible with strict sequencing.
