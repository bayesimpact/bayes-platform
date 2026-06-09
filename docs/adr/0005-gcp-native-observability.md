# ADR-0005: GCP-Native Observability Stack

**Status:** Accepted
**Date:** 2026-03-19
**Context:** Replace scattered observability tools with GCP-native solutions, keeping PostHog for product analytics only.

## Decision

Consolidate all operational observability (error reporting, tracing, monitoring, alerting) on GCP. PostHog remains for product analytics only. LangFuse remains for LLM-specific tracing.

## Current State

- Plain `console.log` everywhere — no structured logging
- OpenTelemetry initialized in `apps/api/src/external/llm/open-telemetry-init.ts` with:
  - `ConsoleSpanExporter` (stdout, noisy)
  - `LangfuseIntegrationExporter` (filters for AI SDK spans only)
- Basic exception filter: `apps/api/src/common/filters/stack-trace-logging-exception.filter.ts`
- Request logger middleware with emojis: `apps/api/src/common/middleware/request-logger.middleware.ts`
- No structured logging, no Cloud Trace, no custom metrics
- `sourceMap: true` already set in `packages/typescript-config/nestjs.json`
- `NODE_ENV=production` already set in Dockerfile

## Implementation Plan

### 1. Source Maps in Production

**File:** `apps/api/Dockerfile`

Add `--enable-source-map` to the Node command so stack traces in Cloud Error Reporting point to original TypeScript files:

```dockerfile
CMD ["node", "--enable-source-map", "/app/apps/api/dist/main.js"]
```

Source maps are already generated (`sourceMap: true` in tsconfig). No build change needed.

### 2. Structured JSON Logger

**Goal:** Replace all `console.log` with a structured logger that outputs JSON. Cloud Run automatically ingests JSON stdout into Cloud Logging with proper severity, and Cloud Error Reporting auto-groups errors with stack traces.

**Approach:** Use Pino (lightweight, Cloud Logging-friendly) or wrap NestJS Logger to output JSON. Key fields:

```json
{
  "severity": "ERROR",
  "message": "Something failed",
  "stack_trace": "Error: ...\n    at ...",
  "httpRequest": { "method": "GET", "url": "/api/..." },
  "logging.googleapis.com/trace": "projects/caseai-connect/traces/TRACE_ID"
}
```

**Files to update:**
- `apps/api/src/main.ts` — configure logger
- `apps/api/src/common/middleware/request-logger.middleware.ts` — replace emoji console.logs with structured JSON
- `apps/api/src/common/filters/stack-trace-logging-exception.filter.ts` — structured error output
- `apps/api/src/domains/documents/storage/storage.module.ts` — replace console.log
- `apps/api/src/domains/documents/embeddings/bull-mq-document-embeddings-batch.service.ts` — replace console.log
- `apps/api/src/gpu-workers-main.ts` — replace console.log

**No GCP SDK needed.** Cloud Run picks up structured JSON from stdout natively.

### 3. Cloud Trace via OpenTelemetry

**Install:** `@google-cloud/opentelemetry-cloud-trace-exporter`

**File:** `apps/api/src/external/llm/open-telemetry-init.ts`

Add Cloud Trace exporter alongside existing LangFuse exporter. No env vars needed — auto-detects credentials from Cloud Run service account.

```typescript
import { TraceExporter } from "@google-cloud/opentelemetry-cloud-trace-exporter"

const spanProcessors = [
  new BatchSpanProcessor(new LangfuseIntegrationExporter({ ... })),
]

if (process.env.NODE_ENV === "production") {
  spanProcessors.push(new BatchSpanProcessor(new TraceExporter()))
} else {
  spanProcessors.push(new BatchSpanProcessor(new ConsoleSpanExporter()))
}
```

- LangFuse exporter filters for `instrumentationScope.name === "ai"` internally — no interference
- Cloud Trace receives all spans
- `ConsoleSpanExporter` only in dev

### 4. OTEL Auto-Instrumentations

**Install:**
- `@opentelemetry/instrumentation-http` — traces all HTTP in/out
- `@opentelemetry/instrumentation-nestjs-core` — traces route handlers, guards, middleware
- `@opentelemetry/instrumentation-pg` — traces every SQL query

**File:** `apps/api/src/external/llm/open-telemetry-init.ts`

Register instrumentations in the `NodeSDK` config. Result: a single request produces a trace waterfall in Cloud Trace showing HTTP → NestJS handler → SQL queries → external calls.

Redis/BullMQ instrumentation is deferred (nice-to-have, workers are async so traces are less connected).

### 5. BullMQ Queue Metrics

**Goal:** Monitor queue health (backlog, failures) via Cloud Monitoring with alerting.

**Approach:** OTEL metrics exported to Cloud Monitoring via `@google-cloud/opentelemetry-cloud-monitoring-exporter`.

- Add a periodic task (every 30s) in the Workers service
- Calls `queue.getJobCounts()` → `{ waiting, active, completed, failed }`
- Records values as OTEL gauge metrics (e.g. `bullmq.queue.waiting`, `bullmq.queue.failed`)
- In production, metrics are exported directly to Cloud Monitoring — no log-based metrics needed
- Alerts configured directly on OTEL metrics in Cloud Monitoring

### 6. Alerting (GCP Console config, not code)

| Alert | Type | Condition |
|-------|------|-----------|
| API errors spike | Log-based | > 5 errors in 5 min |
| Queue backlog | Log-based metric | `waiting` > 50 for 5 min |
| Failed jobs | Log-based metric | `failed` increases |
| Cloud Run 5xx rate | Built-in | > 5% error rate |
| Cloud Run latency | Built-in | p95 > 5s |

Notification channel: Slack (configured once in Cloud Monitoring → Notification channels).

## Observability Stack Summary

| Concern | Tool | How |
|---------|------|-----|
| Product analytics | PostHog | Stays as-is |
| LLM tracing | LangFuse | Stays as-is (OTEL exporter) |
| Distributed tracing | Cloud Trace | New OTEL exporter + auto-instrumentations |
| Logs | Cloud Logging | Structured JSON to stdout (no SDK) |
| Error reporting | Cloud Error Reporting | Auto from structured logs with severity ERROR |
| Metrics & dashboards | Cloud Monitoring | Built-in Cloud Run metrics + OTEL custom metrics |
| Alerting | Cloud Monitoring | OTEL metric-based alerts → Slack |

## Authentication

No additional credentials or env vars needed. All GCP services auto-authenticate via the Cloud Run service account.

## Consequences

- All ops observability consolidated in GCP Console — single pane of glass
- No new external services to manage
- Minimal code changes — mostly replacing console.log + adding OTEL exporters
- Source maps give TypeScript line numbers in error reports
- Queue monitoring enables proactive alerting on BullMQ issues
