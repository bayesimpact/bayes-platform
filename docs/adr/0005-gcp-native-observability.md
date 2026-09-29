# ADR-0005: OpenTelemetry to a gateway

**Status:** Accepted (revised 2026-09-28, replaces the GCP-native stack of 2026-03-19)
**Context:** The platform runs on Kubernetes clusters with a cloud-agnostic monitoring stack. The first version of this ADR exported traces to Cloud Trace, metrics to Cloud Monitoring and LLM traces to Langfuse through a custom exporter. Langfuse v2 has no OTLP endpoint, and v3 needs ClickHouse, Redis and S3.

## Decision

The platform emits standard OTLP and knows no backend. An OpenTelemetry Collector in each cluster (the gateway) receives it and fans it out:

| Signal | Backend |
|--------|---------|
| Metrics (BullMQ queues, retention sweep, ...) | Prometheus |
| Logs (structured JSON on stdout) | Loki |
| LLM traces | Phoenix |

The mapping from the Vercel AI SDK attributes (`ai.*`) to the conventions of a backend (OpenInference for Phoenix) runs in the gateway (`transform` processor), never in the platform.

## Platform side

`apps/api/src/external/llm/open-telemetry-init.ts` registers `OTLPTraceExporter` and `OTLPMetricExporter` (http/protobuf) when `OTEL_EXPORTER_OTLP_ENDPOINT` is set, and exports nothing otherwise. `OTEL_SERVICE_NAME` tells the API from the worker pools. `OTEL_CONSOLE_EXPORT=true` prints spans to stdout for local debugging.

Every LLM call carries telemetry metadata (`ai.telemetry.metadata.*`):

- `sessionId`: our trace id, persisted on the session or run. It groups all the turns of a run; the trace backend shows it as a session.
- `userId`: organization and project.
- `userMessage` on chat turns: the last user message, shown as the input of the turn instead of the whole prompt.
- `tags`, `currentTurn`, `spanLabel`, `agentSessionId`, `parentSessionId` for sub-agents.

The mapping lives in one file, `deploy/helm/bayes-platform/files/otel-collector.yaml`: the chart's optional collector and the local compose mount it, the gateway of our clusters copies its processors. The chart also has an optional Phoenix, not production ready (no authentication, SQLite by default), for a demo or a small install.

The gateway names the top operation of a turn "Turn #4" (or "Turn #4 · classification" with a `spanLabel`), and keeps the side calls of a turn (classification, consolidation) as children, so the session shows the answer of each turn.

Each turn is its own OTEL trace. A sub-agent runs under a fresh root span, so its spans form their own trace and session, linked back to the parent by `parentSessionId` and a `parent-trace:` tag.

## Trace links

`TRACE_URL_TEMPLATE` builds the links shown in the UI and in the logs: `{traceId}` is replaced by our trace id. With Phoenix: `https://<phoenix>/redirects/sessions/{traceId}`, which resolves the session without knowing its project. No template, no link.

## Consequences

- No backend name in the platform code, no backend credentials in its environment: the gateway holds them.
- Switching or adding a backend is a gateway change.
- Local runs export nothing unless pointed at a gateway.
- The grouping of a parent run and its sub-agents in one session is gone: the backend has two levels (session, trace), not three.
