# ADR 0033: LLM token consumption metering

* **Status**: Accepted
* **Date**: 2026-11-13
* **Deciders**: Jérémie
* **Scope**: `apps/api` (the LLM provider base, a metering helper, a migration, a live pricing table), the `analytics` schema ([`docs/analytics-schema.md`](../analytics-schema.md)), and a Grafana dashboard in the platform chart. The observability pipeline (the cluster's OTel gateway to Prometheus) is reused, not changed.

---

## 1. Context

Every LLM call the platform makes is instrumented. `LLMCallContext` already carries the
`organizationId`, the `projectId` and the `agentId` of the call, and the AI SDK puts the
usage of the call (`input_tokens`, `output_tokens`, the cached-input and the reasoning
parts) on the span. Today those numbers only live on the traces, in the trace backend.
They are not queryable for what the platform wants from a dashboard: the token burn per
organization, per project, per agent and per model, over time, and what it costs.

The `analytics` schema — the read-only SQL views the dashboards and the downstream
usage reporting read — has no token data. Its `messages` view has `response_seconds`
and `tool_call_count` but no input or output tokens, and no model.

Adding the tokens to `agent_message` is not an option. A message is purged with its
conversation (`conversation_retention_days`), and the token history that backs a cost
must not go away with the conversation. The numbers have to live in a table of their
own, with a retention of their own.

The metrics path is already wired and is empty where it needs to be. The API emits
OpenTelemetry metrics (the queue metrics), the gateway in the cluster forwards them to
Prometheus, and the cluster Grafana has a Prometheus data source. No token metric is
emitted yet.

## 2. Decision

Token usage is measured at one place, the LLM call boundary, and written in two forms:
a metric for the live burn, and a durable ledger for the token history. The cost is not
stored; it is computed from the ledger and the current prices when it is read. The
metric and the ledger are written from the same call, with the same numbers, so they
always agree.

### The metering point

A single helper records the usage of a call. It is given the `callContext` (the
organization, the project and the agent), the `config` (the model and the provider), and
the message the call belongs to, when there is one. It reads the usage of the call from
the AI SDK result. It is called from the three
entries of the provider base — `streamChatResponse`, `generateText` and
`generateStructuredOutput`. Nothing else in the app writes token numbers. A call is
metered once, wherever it comes from: the answer of a turn, an internal call, an
extraction run, a sub-agent, or an embedding.

### The metric (the live burn)

A counter, `llm.tokens` (Prometheus `llm_tokens_total`), incremented once per call with
the token counts and these labels:

`organization_id`, `project_id`, `agent_id`, `model`, `provider`, and `token_kind`
(`input`, `output`, `cache_read`, `cache_write`, `reasoning`).

It flows through the existing OTel gateway to the cluster Prometheus, with no change to
the pipeline. The token burn dashboard reads it with the usual burn queries
(`sum(increase(llm_tokens_total[1d]))`, `sum(rate(llm_tokens_total[5m]))`) and variables
for the organization, the project, the agent and the model. The metric is not durable
(Prometheus retention) and it carries the workspace ids as labels, the same data the
traces already carry.

### The ledger (the token history)

A table in the product schema, `llm_usage`, one row per LLM call:

* the keys: `organization_id`, `project_id`, `agent_id`, and `agent_message_id` (the
  message the call belongs to, indexed, null when there is none);
* the model: `model`, `provider`, and `call_kind` (the answer of a turn, an internal
  call, an extraction run, an embedding);
* the counts: `input_tokens`, `output_tokens`, `cache_read_tokens`,
  `cache_write_tokens`, `reasoning_tokens`;
* `created_at`, the time of the call.

The table has a retention of its own, independent of the conversation. Purging a
conversation does not touch it. It is a product entity written through its repository.
The API never reads it back.

The `analytics` schema gains a view over it, `analytics.llm_usage`, with
`organization_id`, `project_id`, `agent_id`, the model, the counts, `created_at` and the
computed cost. It drops the row id and `agent_message_id` (a view never exposes an id or
a message id) and adds no column the schema forbids. It joins the `projects` and
`organizations` of the other views, so a dashboard shows the names, not only the ids.

`agent_message_id` is set when the call belongs to a stored assistant message, the
answer of a turn or a sub-agent's message, and null for an embedding or a standalone
extraction run. A dashboard reads the cost per message by summing the rows of a message,
and the total token burn by summing every row.

### The cost (computed live from the current prices)

A pricing table in the database, `llm_model_price`: one row per model and token kind,
with `price_per_million` and a `currency`. It is the live reference of the prices, and
the only thing that is maintained to keep the cost current.

The cost is not stored on the usage row. The `analytics.llm_usage` view computes it
when it is read: it joins each call to the price of its model and token kind, and sums
`tokens × price_per_million / 1e6`. Changing a price re-prices every call of that model,
old and new, the next time the view is read. The cost is therefore always the cost at
the current prices, recomputed, not a receipt of the day it was made.

The table is maintained so it stays live: an update in the backoffice (a new permission
on it) or a maintenance script. The metering point does not read it. Only the view does,
by model and token kind.

If the platform needs the price a call was made under to stay fixed, the table gains a
validity window (`valid_from`, `valid_to`) and the view picks the price active at the
call's `created_at`. Until then it is one current price per model and token kind.

### The dashboards

Two dashboards, provisioned as code (the ConfigMap sidecar, `grafana_dashboard=1`):

* **Token burn**, on the Prometheus data source, in the platform chart: the token volume
  per day, the burn rate, the split by project, agent, model and organization, and the
  share of cached input.
* **Cost and usage**, on the `analytics` data source, in a folder gated to a dedicated
  Grafana team: the cost over time, by project, agent and model, with the organization
  and project names, and the cache efficiency. This is the one the downstream usage
  reporting reads.

## 3. Consequences

* No change to the infra pipeline. The metric is already routed to Prometheus, and
  Grafana already has both the Prometheus and the `analytics` data sources.
* The `analytics` contract changes. `llm_usage` is added to `ANALYTICS_VIEWS`, and the
  schema spec checks the new view like the others. The migration that creates the two
  tables and the view is written by hand, as the views are.
* A call is metered once, at the boundary, so the ledger and the metric count the same
  tokens. The embedding models, separate from the chat models, are captured by the same
  helper.
* The workspace ids in the metric labels and in the ledger are internal ids, not
  personal data, and they match what the traces already carry. The per-workspace cost is
  commercially sensitive: the cost dashboard is gated to a dedicated Grafana team, and
  its members are managed in Grafana without touching the sign-in mapping.
* The label cardinality is organization × project × agent × model × token kind. In
  practice each project uses one or two models, so it is bounded. If it grows, the
  ledger carries the long-term and high-cardinality reads, and the metric drops the
  least-used labels.
* Out of scope: the GPU and the inference-provider performance of the vLLM services, a
  separate decision.
