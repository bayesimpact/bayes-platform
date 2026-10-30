# ADR 0028: Self-hosted embedding models behind a feature flag

- Status: Accepted
- Date: 2026-10-27
- Deciders: Platform team
- Scope: apps/api (documents, agents, workers), apps/web (studio), deploy (Helm chart)

## Context

Every project chunk is embedded with Google Vertex `gemini-embedding-001`, chosen by the
`DOCUMENT_EMBEDDING_MODELS` environment variable, and retrieval always uses that model. Some
deployments want open-weight models such as BAAI/bge-m3, served on their own hardware, for data
residency and for retrieval quality on their language, and want to compare models on an agent
before switching.

Constraints:

- The API image has no Python runtime. The GPU workers image ships Python for Docling only.
- `document_chunk_embedding.embedding` was declared `vector(3072)`, the Gemini size.
- The feature must stay invisible for projects that did not opt in.

## Decision

1. **A catalog of embedding models in code.** `EmbeddingModel` and `EmbeddingModelCatalog` in
   `api-contracts` list every model with its provider and dimensions. Adding a model is a code
   change, like adding an agent model.
2. **A self-hosted model is an embedder like any other, reached through the OpenAI embeddings
   API** (`POST {url}/v1/embeddings`), the de facto standard served by vLLM, text-embeddings-inference,
   Ollama, Infinity and the cloud providers. Each model of the catalog has its endpoint configured
   per deployment (`EMBEDDER_<MODEL>_URL`, `EMBEDDER_<MODEL>_API_KEY`, and `EMBEDDER_<MODEL>_MODEL`
   when the server names the model differently). Chunks at upload, chunks of a re-embedding job and
   chat queries all go through one `EmbedderService`, which calls that endpoint, or Vertex for every
   other model name. A model with no URL is not offered.
3. **The platform runs no model and builds no image for it.** The server is deployed like the
   self-hosted LLMs, outside the chart: for bge-m3, the public vLLM image with `--runner pooling`.
   The chart only reads the URL and key from the application Secret, next to `VLLM_<MODEL>_*`.
4. **Dense vectors only.** bge-m3 can also produce lexical (sparse) weights, but no standard API
   carries them: OpenAI's has no place for them, text-embeddings-inference serves sparse vectors for
   SPLADE models only, and vLLM exposes them through its own pooling API, one task per server. A
   hybrid ranking can come later, for example from Postgres full-text search, once an evaluation
   shows its worth.
5. **Per-project rows drive the rollout.** `project_embedding_model` stores, for each self-hosted
   model a project enabled, the status and progress of the job that embeds the existing chunks.
   New uploads are embedded with the Vertex models plus every active model of their project. An
   embedder failure fails the document, as a Vertex failure does, so a document always has the
   same chunks for every model.
6. **The re-embedding job is idempotent and resumable.** It only touches chunks with no row for
   the model and inserts with `ON CONFLICT DO NOTHING`. It runs on any worker, since it only makes
   HTTP calls. One BullMQ job per row (`jobId` from the row id): enabling a model whose job is gone
   (enqueue failure, retries exhausted) queues it again instead of refusing. A document still being
   processed when the model is enabled embeds itself with it before writing its chunks.
7. **The vector column becomes untyped** (`ALTER COLUMN TYPE vector`), each `model_name` storing
   its own size. Retrieval always filters on `model_name`, so a distance never mixes sizes. No ANN
   index existed, so nothing is lost; per-model partial indexes over a cast remain possible
   (tracked in issue #1012).
8. **The agent names its retrieval model** (`agent_settings.embedding_model`, never null, existing
   agents set to `gemini-embedding-001`). A null "default" would move every agent to a new model
   the day the platform default changes, onto vectors their project may not have. A self-hosted
   model is only selectable once the project finished embedding with it, and only with the
   `local-embeddings` flag.
9. **Retrieval checks the vectors exist before it searches.** It uses the agent's model when the
   project has its vectors (a completed job for a self-hosted model, any vector for a Vertex one),
   and otherwise the first model of `DOCUMENT_EMBEDDING_MODELS` that has them. An embedder failure
   also moves to the next model. Each fallback is a warning in the logs and
   `embeddingFallbackFrom` on the trace. When no model has the project's vectors, retrieval returns
   nothing and the trace carries `embeddingModelMissing`: a silent empty search is the failure this
   guards against.

## Alternatives

- A long-lived Python subprocess inside the GPU workers, with query embeddings sent through a
  BullMQ queue. It tied the model to the workers, sharing their GPU with Docling, and made every
  chat turn depend on a queue round trip.
- Our own HTTP embedder (FastAPI around sentence-transformers) with a contract carrying dense and
  sparse vectors. It kept the bge-m3 hybrid score, but meant an image to build, scan and patch, and
  a contract no other server speaks.
- A catalog stored in the database and managed from the back-office: adding a model without a
  deploy, but dimensions to validate by hand. Not worth it for a handful of models.

## Consequences

- Any OpenAI embeddings server becomes a possible embedder, managed and scaled like the LLMs.
- Chat turns on a self-hosted model add one HTTP call, bounded by `EMBEDDER_QUERY_TIMEOUT_MS`.
- Locally, a laptop serves bge-m3 with Ollama or Infinity (vLLM does not run on Apple Silicon).
- Reverting the migration requires deleting the self-hosted model vectors first; the `down()` does it.
