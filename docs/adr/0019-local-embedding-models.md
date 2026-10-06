# ADR 0019: Local embedding models behind a feature flag

- Status: Accepted
- Date: 2026-09-28
- Deciders: Platform team
- Scope: apps/api (documents, agents, workers), apps/web (studio), infra (GPU workers image)

## Context

Every project chunk is embedded with Google Vertex `gemini-embedding-001`, chosen by the
`DOCUMENT_EMBEDDING_MODELS` environment variable, and retrieval always uses that model. Some
deployments want open-weight models such as BAAI/bge-m3 served
on their own hardware, for data residency and for retrieval quality on their language, and want
to compare models on an agent before switching.

Constraints:

- The API image has no Python runtime; only the GPU workers image ships the Docling venv.
- `document_chunk_embedding.embedding` was declared `vector(3072)`, the Gemini size.
- The feature must stay invisible for projects that did not opt in, and a local checkout must
  be able to run the whole flow on a laptop.

## Decision

1. **Models run inside the GPU workers**, as a long-lived `document_embedder.py --serve`
   subprocess (sentence-transformers) spoken to over JSON lines. One process per worker keeps
   each model loaded once. No sidecar or inference server is introduced. The model catalog is a
   fixed `EmbeddingModel` enum in `api-contracts`, with provider and dimensions.
2. **Per-project rows drive the rollout.** `project_embedding_model` stores, for each local model
   a project enabled, the status and progress of the job that embeds the existing chunks. New
   uploads are embedded with the Vertex model plus every active local model of their project.
3. **The re-embedding job is idempotent and resumable.** It only touches chunks with no row for
   the model and inserts with `ON CONFLICT DO NOTHING`, so a retry or a concurrent upload never
   duplicates work. Progress is stored on the row and polled by the studio while a job runs;
   an SSE stream can replace the polling later.
4. **Query-time embedding goes through BullMQ.** The API adds a job to `query-embeddings` and
   waits for its return value (`waitUntilFinished`), since Redis is the only channel the API and
   the GPU workers already share. On timeout or error it falls back to the Vertex model and logs
   a warning: a slightly less relevant answer beats no answer.
5. **The vector column becomes untyped** (`ALTER COLUMN TYPE vector`), each `model_name` storing
   its own size. Retrieval always filters on `model_name`, so a distance never mixes sizes. No
   ANN index existed, so nothing is lost; per-model partial HNSW indexes remain possible with a
   cast expression.
6. **The agent picks its retrieval model** (`agent_settings.embedding_model`, null meaning the
   default). A local model is only selectable once the project finished embedding with it, and
   only with the `local-embeddings` flag.

## Alternatives

- A separate inference container (text-embeddings-inference, vLLM) with an OpenAI-compatible
  endpoint: cleaner at scale but a new deployable per model and a new network path from the API.
  Rejected for now; the bridge is one class to swap if it becomes worth it.
- Embedding in Node (transformers.js): no Python, but uneven support for these models and a
  slower path.
- One column per dimension: exact types, but a schema change per new model.

## Consequences

- The GPU image grows by the model weights (about 2.3 GB for bge-m3). The catalog starts with
  bge-m3 only; a gated model such as EmbeddingGemma would need a HuggingFace token at build time.
- Chat turns on a local model add a Redis round trip (tens to a few hundred milliseconds when the
  worker is idle). The `query-embeddings` worker runs with its own concurrency so a long
  re-embedding job does not block it.
- Reverting the migration requires deleting the local model vectors first; the `down()` does it.
- Locally, `LOCAL_EMBEDDINGS_ENABLED=true` on the workers process plus
  `pip install -r apps/api/requirements-embeddings.txt` in the repo venv runs the whole flow on
  CPU or Apple Silicon.
