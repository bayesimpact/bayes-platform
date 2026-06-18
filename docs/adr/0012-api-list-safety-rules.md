# ADR 0012: API List Safety Rules — Pagination, Lean DTOs, and Proper Storage

* **Status**: Proposed
* **Date**: 2026-06-18
* **Deciders**: Alexis, Jérémie, Noé, Thomas, Olivier et Didier
* **Scope**: `apps/api` (NestJS controllers, services, entities) and `packages/api-contracts` (DTOs, routes).

---

## 1. Context and Problem Statement

In June 2026 the API server started experiencing Node.js OOM (Out of Memory) crashes in production. The issue was first observed on the back-office user list endpoint, where returning all users without pagination exhausted the server heap. Investigation then identified the same class of problem — with additional aggravating factors — on the `GET /documents/webCrawl` list endpoint used by the Web Sources page. Root-cause analysis of that endpoint identified three compounding problems:

1. **Heavy content loaded for every list row.** The `DocumentDto` included a `pages` field — a `{ url, markdown }[]` array containing the full markdown of every crawled URL. The UI only needs the `url` values to render the list, but the full markdown was included in the DTO and — critically — also loaded from the database: PostgreSQL cannot project individual fields out of a JSON array column, so the full blob is always returned by the `SELECT`. The OOM crash happens immediately after the SQL query executes, when Node.js materialises every `markdown` string from every page of every crawled document simultaneously in heap memory.

2. **Content stored in a JSON column.** All crawled pages were stored as a single JSON blob in the `content` column of the `documents` table. This is the underlying reason why the SQL projection problem above cannot be worked around without a schema change.

3. **No pagination.** The endpoint returned the entire project document set in a single query. With many web crawl documents, each carrying a large `content` blob, the combined in-memory allocation exceeded the Node.js heap limit.

Each problem alone would have been manageable. Together they meant that a single list request could exhaust the server heap, and the problem compounded because the request was re-triggered on every SSE status event and every CRUD operation, producing concurrent in-flight copies of the same enormous allocation.

This ADR formalises the three rules that should have prevented this situation.

---

## 2. Decision

### Rule 1 — Lean list DTOs: no heavy content in collection responses

List endpoints MUST return a lean DTO that contains only the fields needed to render a list row. Full content fields MUST be reserved for single-resource (`getOne`) endpoints.

**A field is "heavy"** if its size grows linearly with user-generated input. Concrete examples: extracted text, HTML, markdown, `{ url, markdown }[]` page arrays, raw file content, large embedded sub-resource arrays. These are banned from list DTOs regardless of current data volume.

**Fields that are always safe in lists**: `id`, `title`, `status`, scalar summary counts (e.g. `pageCount: number`), timestamps, foreign keys, embedding status.

**This rule has two halves that must both be applied.** Removing a heavy field from the DTO is not enough if the ORM query still loads the full entity row into memory. A `SELECT *` (or the default TypeORM `find()` with no `select` option) will read the `content` column from PostgreSQL and allocate it in the Node.js heap before the DTO serialiser ever gets a chance to discard it. The OOM happens at that point, not at serialisation.

Both layers must be lean together:
- **DTO layer**: the list DTO type must not include heavy fields.
- **SQL layer**: the list query must use a column projection (`select`) to exclude heavy columns from the `SELECT` statement entirely.

```typescript
// service — project only the columns needed for the list DTO
const [items, total] = await this.documentConnectRepository.findAndCount(connectScope, {
  select: {
    id: true,
    title: true,
    sourceType: true,
    embeddingStatus: true,
    createdAt: true,
    updatedAt: true,
    // content and other heavy fields intentionally omitted
  },
  where: [{ sourceType, uploadStatus: "uploaded" }],
  relations: ["tags"],
  order: { createdAt: "DESC" },
  take: pagination.limit,
  skip: pagination.offset,
})
```

**Structural enforcement**: each domain that has both a list endpoint and a detail endpoint MUST declare two distinct DTO types:

```typescript
// packages/api-contracts/src/documents/documents.dto.ts

// Used only in getAll — no heavy fields
export type DocumentListItemDto = {
  id: string
  title: string
  sourceType: DocumentSourceType
  embeddingStatus: DocumentEmbeddingStatus
  pageCount?: number        // summary scalar, safe
  tagIds: string[]
  createdAt: TimeType
  updatedAt: TimeType
}

// Used only in getOne — may include full content
export type DocumentDto = DocumentListItemDto & {
  content?: string
  pages?: DocumentCrawledPageDto[]
  // ...
}
```

Using `DocumentDto` (the full type) in a list route definition is a type-level signal that the rule has been violated — treat it as a code review blocker. A list service method that does not specify `select` is the service-layer equivalent.

---

### Rule 2 — Paginate list endpoints by default

Every `getAll`-style endpoint (an endpoint that returns a collection of resources) **MUST** support server-side pagination via `limit` and `offset` query parameters.

**Default values**: `limit=50`, `offset=0`. **Hard cap**: `limit` MUST be clamped to a maximum of 200 server-side to prevent abuse.

**Response shape**: paginated list responses MUST use the `{ items: T[], total: number }` wrapper so callers always know the full count even when fetching a single page:

```typescript
// routes
getAll: defineRoute<ResponseData<{ items: DocumentListItemDto[]; total: number }>>({ ... })

// controller
return { data: { items: items.map(toListDto), total } }
```

**Exemptions**: an endpoint MAY be exempt from pagination if, and only if, the number of resources is bounded by a hard constraint enforced in code — not by an estimate or convention. The exemption MUST be documented in a comment at the route definition. Example of a valid exemption: a list of roles on a fixed enum. Example of an invalid exemption: "we don't expect many documents per project."

When in doubt, paginate.

---

### Rule 3 — Do not store large, unbounded content in JSON columns

JSON columns are appropriate for small, bounded structured data: configuration objects, feature flag maps, a handful of key-value metadata fields. They are **not** appropriate when the data can grow without a known upper bound.

**The test to apply at design time**: ask "Will I ever need to paginate or filter within this JSON array?" If the answer is yes — or even "maybe" — the data belongs in a dedicated table, not a JSON column.

**Secondary signal**: if a field is excluded from the list DTO because it is too heavy (Rule 1), that is a strong sign it should not be a JSON column either. A JSON column that is too big to return in a list response will also be too big to load unnecessarily on every database read.

**Guidance for new entities**:

| Data characteristic | Storage |
|---|---|
| Small, bounded structured metadata (< ~10 fields, values are scalars) | JSON column — fine |
| An array of child objects where each object has content fields | Dedicated table |
| Content that needs to be queried, filtered, or paginated independently | Dedicated table |
| Content that grows with user input and has no known upper bound | Dedicated table |

When in doubt, prefer a dedicated table. The cost is a migration; the benefit is proper indexing, lazy loading, and the ability to paginate without reading the full blob.

---

## 3. Why Not Alternatives?

### Leave pagination to the caller ("we'll add it if needed")

This is the status quo that caused the OOM. Volume grows silently; by the time it is noticed, there may be a production incident. Pagination as an afterthought also requires a breaking API change. Doing it upfront is cheaper.

### Return all fields in the list, let the frontend ignore what it doesn't need

The API server still serialises and allocates the full payload. The network cost is real. "Ignore it in the UI" does not make it free — the server heap pressure is unchanged.

### Compress the JSON column / stream it

Compression reduces bandwidth but does not reduce in-memory allocation once decompressed. Streaming a single multi-MB SSE chunk still transfers the full payload. Neither approach solves the root cause.

### Store everything in a single table and select only needed columns

TypeORM's `select` option partially helps, but the JSON column is a single opaque blob — you cannot `select` individual elements of a JSON array without loading the whole thing. A dedicated table exposes individual rows to SQL-level projection.

---

## 4. Consequences

* **Positive**: list endpoints are bounded by construction. Lean DTOs keep response payloads small regardless of how much content individual resources accumulate. Dedicated tables for large content enable proper lazy loading and pagination.
* **Negative**: each new list endpoint requires slightly more boilerplate (two DTOs, a pagination wrapper, a `findAndCount` query). Introducing dedicated tables instead of JSON columns requires a migration.
* **Migration**: existing endpoints that violate these rules are NOT required to be migrated immediately. The rules apply going forward; backfill is prioritised when an endpoint shows signs of becoming a performance problem. The `documents` endpoint was the first backfill.
