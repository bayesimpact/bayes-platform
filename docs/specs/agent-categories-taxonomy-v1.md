# Feature Specification: Agent Categories Taxonomy (v1)

> **Naming note (2026-06)**: this concept was renamed to **agent session categories** to make it
> clear that categories classify agent *sessions* (conversations), not agents themselves. Current
> names: `project_agent_session_category` / `ProjectAgentSessionCategory`,
> `agent_session_category` / `AgentSessionCategory`, route `.../agent-session-categories`, CLI
> `project:set-agent-session-categories` and `agent:set-session-categories`, UI label
> "Conversation categories". The back-office management endpoint described below was removed.
> The historical names below are kept as written for v1.

## Overview

This feature introduces a project-level category taxonomy for conversational agent sessions.

Instead of managing categories independently per agent, workspace admins can:

1. define the category list once at project level,
2. assign a subset of those categories to each agent,
3. let the AI session metadata tool pick only from categories available to the current agent,
4. analyze sessions per category over time (for one agent or all agents).

---

## Scope (v1)

### In Scope

- Project-level category definitions (`project_agent_category`).
- Agent-level category assignment (`agent_category` as assignment table).
- Session-level category tagging via AI SDK metadata tool.
- Max 5 categories per conversation session.
- Category analytics:
  - by selected agent,
  - or across all project agents.
- CLI support for:
  - setting project categories,
  - assigning agent categories from the project list.

### Out of Scope (v1)

- UI CRUD for category management in Studio.
- Category hierarchy/parent-child taxonomy.
- Category localization.
- Historical retro-tagging jobs.

---

## Data Model

### `project_agent_category`

Canonical category definition within a workspace.

- `id`
- `project_id`
- `name`
- timestamps + `deleted_at`
- unique: `(project_id, name)`

### `agent_category`

Assignment of project categories to a specific agent.

- `id`
- `agent_id`
- `project_agent_category_id`
- `name` (copied for compatibility/traceability)
- timestamps + `deleted_at`
- unique constraints include:
  - `(agent_id, name)`
  - `(agent_id, project_agent_category_id)`

### `conversation_agent_session_category`

Join table for session tags.

- `conversation_agent_session_id`
- `agent_category_id`
- `project_agent_category_id` (nullable compatibility bridge)
- timestamps

---

## AI SDK Tool Behavior

Tool: `RecalculateConversationSessionMetadata`

The metadata tool:

- receives the list of available category names for the current agent,
- receives current session categories,
- returns the full set of categories that should remain on session (replace strategy),
- can return `suggestedTitle` as nullable,
- is registered only when the agent has available categories.

Session update behavior:

- clear current session-category links,
- insert selected categories (max 5),
- persist normalized title.

---

## Analytics Behavior

Project analytics endpoint for category-per-day supports:

- optional `agentId` query:
  - if provided: category time series for that agent,
  - if omitted: category time series across all project agents.

UI behavior on project analytics page:

- `Sessions per day by category` chart is always visible.
- Agent filter still exists:
  - selected agent => chart for that agent,
  - all agents => aggregated category counts per day across all agents.

---

## CLI Usage

### 1) Define workspace category taxonomy

Command (from `apps/api`):

`npm run project:set-agent-categories`

Flow:

1. confirm DB target,
2. select organization,
3. select workspace (project),
4. choose categories (defaults and/or explicit names),
5. confirm replacement.

Optional:

`npm run project:set-agent-categories -- --categories "billing,support,bug"`

### 2) Assign categories to an agent

Command (from `apps/api`):

`npm run agent:set-categories`

Flow:

1. confirm DB target,
2. select organization,
3. select workspace,
4. select agent,
5. choose categories from **project category list** (multi-select),
6. confirm replacement.

Optional:

`npm run agent:set-categories -- --categories "billing,support"`

Notes:

- If no project categories exist, the CLI asks to run `project:set-agent-categories` first.
- Agent assignment always replaces currently active assignments.

---

## Validation / Completion Criteria

Before considering implementation done:

- `npm run biome:check`
- `npm run typecheck`
- `npm run test`
- `cd apps/api && npm run check:circular`
- `cd apps/api && npm run check:deps`

Per current team instruction, circular/deps baseline maintenance can be performed with:

- `npm run check:deps:baseline`
- `npm run check:circular:baseline`

---

## Open Questions

1. Should session tags migrate to rely only on `project_agent_category_id` in v2 (and remove `agent_category_id`)?
2. Should deleted project categories stay visible in historical analytics under a separate toggle?
3. Do we want API-level endpoints dedicated to managing project categories and assignments (beyond CLI)?
