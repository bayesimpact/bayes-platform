# Feature Specification: Extraction Agent (v0)

## Overview

This feature introduces a new **Extraction Agent** type that performs **single-shot structured extraction** from a file.

Unlike conversational agents, the extraction flow is request/response:

1. Client sends a file reference and extraction request
2. API calls the LLM with:
   - an extraction prompt
   - a JSON Schema
   - the file content
3. API validates the output against the schema
4. API returns a structured JSON result (or a structured error)
5. API persists one history record per execution as `AgentExtractionRun`

This v0 is backend-only. UI/UX will be defined later.

---

## Scope (v0)

### In Scope

- New agent type: `extraction`
- Synchronous extraction endpoint
- Single file extraction per request
- Schema-constrained structured output
- Server-side JSON schema validation before response
- Authorization model identical to existing `Agent` routes
- Run history persisted as `AgentExtractionRun`

### Out of Scope

- Conversational/multi-turn extraction flows
- Async job queue and polling
- Batch extraction (multiple files in one request)
- UI/UX definition and implementation

---

## Core Product Decisions

1. **Execution model**: synchronous HTTP endpoint
2. **Authorization**: Extraction Agent routes check RBAC permissions the same way Agent routes do
3. **Source document**: reuse existing `documents` domain (document uploaded first, then referenced by `documentId`)
4. **Document source type**: extraction uploads must use `sourceType = "extraction"`
5. **Contract**: strict structured response based on JSON schema
6. **History model**: persist each execution as `AgentExtractionRun` (not `AgentSession`)
7. **Validation failure behavior**: return `422` and persist run as `failed`
8. **Pagination**: no pagination in v0 for run history
9. **AI SDK usage**: use AI SDK structured output mode with schema provided to generation call

---

## Domain Placement Decision

Extraction remains in the `agents` domain for v0.

Rationale:

- authorization is identical to `Agent`
- extraction is scoped by existing `organization` + `project` + `agent` context
- avoids duplicate module and guard wiring
- keeps `Agent.type` and execution behavior in one cohesive domain

Suggested folder layout (v0):

- `apps/api/src/domains/agents/`
  - `...existing agent files...`
  - `agent-extraction-runs/`
    - `agent-extraction-run.entity.ts`
    - `agent-extraction-runs.controller.ts`
    - `agent-extraction-runs.service.ts`
    - `e2e-tests/...`
    - `service-tests/...`

---

## Functional Requirements

### FR1 — Agent Type

Agents can be configured as one of:

- `conversation` (existing)
- `extraction` (new)

Extraction-specific configuration:

- `instructionPrompt: string`
- `outputJsonSchema: object` (JSON Schema for expected output)

For `type = "extraction"`, both fields are required at creation time.

### FR2 — Extraction Endpoint (Sync)

The API exposes a sync extraction endpoint under the agent scope.

The endpoint:

- verifies auth + context (`organization`, `project`, `agent`)
- verifies caller permissions with `@CheckPermission`, as `Agent` routes do
- verifies agent type is `extraction`
- loads the document by `documentId` within connect scope
- calls the LLM with prompt + schema + file
- validates model output against schema
- returns validated structured data

### FR3 — Output Validation

- If model output is valid against schema: return `200` with `data`
- If model output cannot be validated: return explicit validation error
- API must not return schema-invalid structured output as success
- On schema validation failure, API returns `422` and stores the run with `status = "failed"`

### FR4 — Run History

- Every extraction request creates one `AgentExtractionRun` record
- Run history is queryable per agent
- A run stores input references, status, and either structured output or error details

---

## Proposed API Contract (v0)

> Final route naming should follow `defineRoute` conventions in `@caseai-connect/api-contracts`.
> This section defines behavior and payload shape for implementation.

### Endpoint (execute extraction)

- `POST organizations/:organizationId/projects/:projectId/agents/:agentId/extract`

### Request

```json
{
  "payload": {
    "documentId": "uuid",
    "promptOverride": "optional per-run instruction"
  }
}
```

`promptOverride` is optional. If omitted, `instructionPrompt` from the agent config is used.

### Success Response (`200`) — execute

```json
{
  "data": {
    "runId": "uuid",
    "result": {}
  }
}
```

`result` must conform to the agent's `outputJsonSchema`.

### Endpoint (list run history)

- `GET organizations/:organizationId/projects/:projectId/agents/:agentId/extraction-runs`

### Success Response (`200`) — list history

```json
{
  "data": {
    "runs": [
      {
        "id": "uuid",
        "agentId": "uuid",
        "documentId": "uuid",
        "status": "success",
        "createdAt": 0,
        "updatedAt": 0
      }
    ]
  }
}
```

This endpoint returns all runs in v0 (no pagination).

### Endpoint (get one run)

- `GET organizations/:organizationId/projects/:projectId/agents/:agentId/extraction-runs/:runId`

### Success Response (`200`) — one run

```json
{
  "data": {
    "id": "uuid",
    "agentId": "uuid",
    "documentId": "uuid",
    "status": "success",
    "result": {},
    "errorCode": null,
    "errorDetails": null,
    "createdAt": 0,
    "updatedAt": 0
  }
}
```

### Error Response (examples)

- `400/422` invalid input (missing `documentId`, invalid schema config, etc.)
- `403` unauthorized (same permission semantics as existing agent endpoints)
- `404` agent/document/run not found in scope
- `422` schema validation failed on model output
- `500/502` upstream LLM/provider failure

Recommended error codes in response body:

- `AGENT_TYPE_MISMATCH`
- `DOCUMENT_NOT_FOUND`
- `RUN_NOT_FOUND`
- `SCHEMA_VALIDATION_FAILED`
- `EXTRACTION_PROVIDER_ERROR`

---

## Authorization

Extraction Agent authorization must reuse the current Agent authorization rules:

- same guard stack (`JwtAuthGuard`, `UserGuard`, `ResourceContextGuard`, `CheckPermissionGuard`)
- `@CheckPermission` on each route with an `agent.extraction.session.*` key, granted on roles in the RBAC catalog (ADR 0019)
- same scoped access model using `organizationId` + `projectId`

No custom role logic is introduced in v0.

---

## Data and Domain Notes

### Agent Config

Use the `Agent.type` column to represent agent behavior:

- `type: "conversation" | "extraction"` (default: `"conversation"`)
- `instructionPrompt`
- `outputJsonSchema`

For `conversation` agents, current behavior remains unchanged.
For `extraction` agents, chat/session endpoints are not part of this v0 flow.

Validation rules:

- If `type = "extraction"`, `instructionPrompt` and `outputJsonSchema` are required.
- If `type = "conversation"`, extraction fields are ignored.

### `AgentExtractionRun` Entity (v0)

Proposed fields:

- `id: uuid`
- `agentId: uuid`
- `userId: uuid`
- `documentId: uuid`
- `status: "success" | "failed"`
- `result: jsonb | null` (validated output)
- `errorCode: string | null`
- `errorDetails: jsonb | null`
- `effectivePrompt: text`
- `schemaSnapshot: jsonb`
- `traceId: uuid`
- `createdAt`, `updatedAt`

Design note: `AgentExtractionRun` is intentionally separate from `AgentSession`. `AgentSession` remains chat-oriented, while extraction runs represent single-shot structured executions.

### Document Reuse

- Use existing `Document` entity and storage pipeline
- Extraction endpoint receives `documentId` (no inline upload in this endpoint)
- Uploaded documents used for extraction runs must be created with `sourceType = "extraction"`
- `AgentExtractionRun.documentId` references that uploaded extraction document
- Existing project documents listing should continue excluding extraction documents

---

## Processing Flow (Server)

1. Authenticate user
2. Resolve context (`organization`, `project`, `agent`)
3. Check the permission (same as Agent routes)
4. Create `AgentExtractionRun` with initial status
5. Validate extraction request payload
6. Load `documentId` in scoped context
7. Build effective prompt:
   - `promptOverride` if present
   - else `instructionPrompt` from agent config
8. Call LLM with file + prompt + schema
9. Parse and validate response against `outputJsonSchema`
10. Update run with `success` + `result` OR `failed` + error payload
11. Return validated structured output and `runId`

Implementation note:

- Use AI SDK structured output mode and pass the output schema in generation parameters.

---

## Non-Functional Requirements

- Endpoint should complete within standard API timeout budget for sync requests
- Full request traceability should remain available through existing observability (trace id)
- No degradation of existing conversational agent behavior

---

## Testing Requirements (v0)

### E2E

- Auth coverage equivalent to existing agent domain patterns:
  - no token
  - invalid/missing scope params
  - unauthorized roles
  - authorized roles
- Functional coverage:
  - valid extraction success
  - wrong agent type (`conversation` used on extract endpoint)
  - document not found
  - model output schema validation failure
  - provider error propagation
  - run is persisted for both success and failure
  - list history endpoint returns recent runs for the agent
  - get-one endpoint returns full run detail

### Service Tests

- extraction service method success path
- schema validation failure mapping
- prompt override behavior
- scoped document lookup behavior
- run persistence lifecycle
- run status transitions (`success` / `failed`)

---

## Open Questions (Post-v0)

1. Should we store raw model output in addition to validated `result`?
2. Should we add retries/repair loops when schema validation fails?
3. Should we support text/csv/docx extraction at parity with image/pdf in the first incremental release after v0?
4. Should extraction results include confidence/citation metadata?
