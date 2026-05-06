# RAG System Architecture

This document explains how the current Retrieval-Augmented Generation (RAG) system works end-to-end in production code.

It covers:

- document ingestion and embedding
- vector storage and retrieval
- how retrieval is invoked during chat
- operational dependencies and environment variables
- known limitations in the current implementation

---

## Scope

The current RAG implementation is designed for **conversation agents** and retrieves content from **project documents** that have completed embedding.

At a high level, the system has two flows:

1. **Offline indexing flow**: upload document -> extract text -> chunk -> embed -> store vectors
2. **Online answer flow**: user message -> LLM may call retrieval tool -> top chunks returned -> grounded answer generation

---

## High-Level Architecture

### Main Components

- **Upload/API layer**
  - `apps/api/src/domains/documents/documents.controller.ts`
- **Embedding queue (producer)**
  - `apps/api/src/domains/documents/embeddings/bull-mq-document-embeddings-batch.service.ts`
- **Embedding worker (consumer)**
  - `apps/api/src/domains/documents/embeddings/document-embeddings.worker.ts`
  - `apps/api/src/domains/documents/embeddings/document-embeddings-processor.service.ts`
  - `apps/api/src/workers-main.ts`
- **Text extraction**
  - `apps/api/src/domains/documents/embeddings/document-text-extractor.service.ts`
  - `apps/api/src/external/docling/docling.cli.ts`
  - `apps/api/src/external/docling/docling.constants.ts`
- **Vector retrieval service**
  - `apps/api/src/domains/documents/embeddings/document-chunk-retrieval.service.ts`
- **Chat streaming + tool loop**
  - `apps/api/src/domains/agents/shared/agent-session-messages/streaming/streaming.service.ts`
  - `apps/api/src/domains/agents/shared/agent-session-messages/streaming/tools/retrieve-project-document-chunks.tool.ts`
  - `apps/api/src/domains/agents/shared/agent-session-messages/streaming/master-promts/conversation-agent.prompt.ts`

### Data Storage

- **Document metadata** in `document` table (`source_type`, `embedding_status`, etc.)
- **Chunks** in `document_chunk`
- **Embeddings** in `document_chunk_embedding` with `embedding vector(3072)`
- Schema introduced in:
  - `apps/api/src/migrations/1773158795873-document-chunks.ts`

---

## Flow 1: Ingestion and Indexing

### 1) Upload and document record creation

When a file is uploaded through `DocumentsController.uploadOne`:

- file type and size are validated (max 10 MB)
- file is saved via configured file storage (`local` or `GCS`, depending on runtime config)
- a `document` row is created with:
  - `sourceType` (`"project" | "agentSessionMessage" | "extraction"`)
  - file metadata (`mimeType`, `fileName`, `storageRelativePath`, etc.)
  - initial `embeddingStatus = "pending"`

### 2) Embedding job enqueue

If `sourceType === "project"`, the API enqueues a BullMQ job:

- queue: `DOCUMENT_EMBEDDINGS_QUEUE_NAME` (defaults to `document-embeddings`)
- job: `create-embeddings`
- payload includes `documentId`, `organizationId`, `projectId`, `uploadedByUserId`, and trace metadata

This happens in:

- `documents.controller.ts` -> `enqueueCreateEmbeddingsForDocument(...)`
- `bull-mq-document-embeddings-batch.service.ts`

### 3) Worker processing

A separate workers process (`workers-main.ts`) consumes embedding jobs.
At startup, workers run a Docling health check (`document_chunker --docling-version`) when Docling extraction is enabled.

For each job, `DocumentEmbeddingsProcessorService.processDocument(...)`:

1. loads document by scoped IDs
2. sets `embeddingStatus = "processing"`
3. reads file bytes from storage
4. extracts plain text by MIME type
5. chunks text with LlamaIndex `SentenceSplitter`:
   - `chunkSize = 512`
   - `chunkOverlap = 50`
6. creates embeddings with Vertex AI for each configured model in `DOCUMENT_EMBEDDING_MODELS`
7. deletes prior chunks for the document and reinserts fresh chunks + vectors
8. sets `embeddingStatus = "completed"` on success, `"failed"` on error

### 4) Text extraction behavior

`DocumentTextExtractorService` currently supports:

- Docling-first extraction for:
  - PDF
  - DOC/DOCX
  - PPT/PPTX
  - XLS/XLSX
  - common image formats (`png`, `jpeg`, `jpg`, `tiff`, `bmp`, `webp`)
- direct UTF-8 decode for TXT/CSV
- fallback extraction when Docling fails:
  - PDF -> `@llamaindex/readers/pdf`
  - DOC/DOCX -> `mammoth`

Unsupported MIME types throw `UnsupportedMediaTypeException` during embedding.

---

## Flow 2: Retrieval During Chat

### 1) Streaming starts

Conversation requests go through `StreamingService.streamAgentResponse(...)`:

- user message is persisted
- assistant placeholder message is persisted with `status = "streaming"`
- SSE stream starts (`start`, `chunk`, `end`, `error`)

### 2) Tool availability for conversation agents

For `agent.type === "conversation"`, `buildTools(...)` registers:

- `retrieveProjectDocumentChunks`

Tool registration and schema live in:

- `retrieve-project-document-chunks.tool.ts`

Tool input:

- `conversationSummary` (optional)
- `latestUserQuestion` (required)
- `topK` (default 3, max 10)

### 3) Prompt instruction to use retrieval

The conversation master prompt explicitly instructs the model:

- call retrieval when user asks about project-doc information
- use returned chunks as primary context
- avoid inventing facts outside retrieved chunks

This instruction is in:

- `master-promts/conversation-agent.prompt.ts`

### 4) Retrieval query construction

`DocumentChunkRetrievalService` builds retrieval text as:

- `Conversation summary: ...`
- `Latest user question: ...`

That text is embedded using the **first model** from `DOCUMENT_EMBEDDING_MODELS`.

### 5) Similarity search in pgvector

The service runs a SQL query over `document_chunk_embedding` with:

- cosine distance operator `<=>`
- ascending order by distance
- `limit topK`
- scoped filters:
  - `organization_id`
  - `project_id`
  - `model_name`
  - `document.embedding_status = "completed"`
  - `document.source_type = "project"`
  - soft-delete filters
- optional document-tag filtering via `document_document_tag`

There is currently **no re-ranking stage** after initial vector retrieval; results are used in raw similarity order from pgvector.

Returned chunk shape includes:

- `chunkId`, `documentId`, `documentTitle`, `documentFileName`
- `chunkIndex`, `content`, `distance`, `modelName`

### 6) Final answer generation

The tool output is fed back into the model through the AI SDK tool loop, and the assistant continues generation. Output tokens are streamed to client via SSE.

Tool executions are also persisted in message history as `"tool"` messages with arguments for audit/debug visibility.

---

## Runtime Dependencies

### Required Environment Variables (RAG-related)

- `GOOGLE_VERTEX_PROJECT`
- `GOOGLE_VERTEX_LOCATION`
- `DOCUMENT_EMBEDDING_MODELS` (comma-separated; first model is used for retrieval query embedding)
- `BULLMQ_REDIS_URL` (defaults to `redis://localhost:6379` if unset)
- `DOCUMENT_EMBEDDINGS_QUEUE_NAME` (optional, defaults to `document-embeddings`)
- `DOCUMENT_EXTRACTOR_DOCLING_ENABLED` (optional, defaults to `true`)
- `DOCUMENT_CHUNKER_COMMAND` (optional path override for `apps/api/bin/document_chunker`)
- `DOCUMENT_EXTRACTOR_DOCLING_TIMEOUT_MS` (optional, extraction timeout and worker health-check timeout source)

### Storage/Infra Variables Used in the Flow

- `GCS_STORAGE_BUCKET_NAME` (when using GCS storage backend)
- `GCS_CREDENTIALS` / `GOOGLE_APPLICATION_CREDENTIALS` (GCS auth, depending on deployment)
- `LOCAL_STORAGE_SERVER_BASE_URL` (for local storage URL resolution where relevant)

### External Services

- Google Vertex AI (embeddings + chat models)
- PostgreSQL with `pgvector`
- Redis (BullMQ queue)
- Google Cloud Storage (optional file storage backend)
- Docling runtime available through the `document_chunker` wrapper script in worker container/host

---

## Operational Notes

### Worker process is mandatory

Document uploads do **not** synchronously compute embeddings. If the worker process is down, documents remain in `pending`/`failed` states and will not be retrievable.

In deployment, workers are started separately with:

- `node /app/apps/api/dist/workers-main.js`

When Docling extraction is enabled, workers fail fast at startup if the Docling CLI health check fails.

### Re-index behavior

On reprocessing a document, existing `document_chunk` rows are deleted first, then all chunks/embeddings are inserted again. This keeps chunk set consistent with latest file content and model outputs.

---

## Known Limitations

- File-extension validator in upload currently allows only a narrower list (`png|jpeg|jpg|pdf|txt|csv`) than MIME checks.
- No ANN vector index (e.g. HNSW/IVFFlat) is created in migration for `embedding`; retrieval uses direct `<=>` ordering.
- No re-ranker is used today; chunk ranking is only the initial vector similarity ranking from pgvector.
- Retrieval only considers `source_type = "project"` and `embedding_status = "completed"`.
- Tool input caps `topK` at 10.
- `document_chunk_embedding` vector writes use raw SQL because TypeORM does not natively support `pgvector` columns in current usage.
- Docling is executed via CLI per extraction call, which adds subprocess overhead.

---

## Sequence Diagram (Textual)

1. User uploads project document.
2. API stores file + `document` row (`pending`) and enqueues embedding job.
3. Worker pulls job, extracts text, splits chunks, embeds, writes chunk/vector rows.
4. Document transitions to `completed`.
5. User asks question in conversation chat.
6. Model may call `retrieveProjectDocumentChunks`.
7. Retrieval service embeds query text and runs pgvector similarity search.
8. Tool returns top chunks + metadata.
9. Model answers with retrieved chunks as grounding context.
10. Response is streamed via SSE and persisted.

---

## Related Documents

- ADR: `docs/adr/0002-document-type-qa-processing-rag.md`
- Chat runtime architecture: `docs/chat-playground-architecture.md`
