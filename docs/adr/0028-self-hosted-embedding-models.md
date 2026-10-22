# ADR 0028: Self-hosted embedding models behind a feature flag

- Status: Accepted
- Date: 2026-10-14
- Deciders: Platform team
- Scope: apps/api (documents, agents, workers), apps/embedder, apps/web (studio), infra (dev compose)

## Context

Every project chunk is embedded with Google Vertex `gemini-embedding-001`, chosen by the
`DOCUMENT_EMBEDDING_MODELS` environment variable, and retrieval always uses that model. Some
deployments want open-weight models such as BAAI/bge-m3, served on their own hardware, for data
residency and for retrieval quality on their language, and want to compare models on an agent
before switching.

Constraints:

- The API image has no Python runtime. The GPU workers image ships Python for Docling only.
- `document_chunk_embedding.embedding` was declared `vector(3072)`, the Gemini size.
- The feature must stay invisible for projects that did not opt in, and a local checkout must be
  able to run the whole flow on a laptop.

## Decision

1. **A catalog of embedders in code.** `EmbeddingModel` and `EmbeddingModelCatalog` in
   `api-contracts` list every model with its provider, dimensions and, for bge-m3, its lexical
   (sparse) head. Adding a model is a code change, like adding an agent model.
2. **Self-hosted models are reached over HTTP, whatever the context.** Each self-hosted model of
   the catalog has an endpoint, configured per deployment (`EMBEDDER_<MODEL>_URL` and
   `EMBEDDER_<MODEL>_API_KEY`, `EMBEDDER_BGE_M3_URL` for bge-m3). Chunks at upload, chunks of a
   re-embedding job and chat queries all go through one `EmbedderService`, which calls the
   endpoint, or Vertex for every other model name. A model with no URL is not offered.
3. **One contract, owned by us.** `POST {url}/v1/embed` takes `{ model, texts, input_type }` and
   returns `{ dimensions, dense, sparse }`. The OpenAI embeddings format was set aside: it has no
   place for the lexical weights the bge-m3 hybrid score needs. Any server honouring the contract
   can serve a model.
4. **`apps/embedder` is the reference embedder**: FastAPI around sentence-transformers, with the
   model weights baked into its image. Queries and document batches run on separate threads so a
   chat turn never waits behind a re-embedding batch. CPU by default, CUDA with a build argument.
   It is deployed on its own, so the GPU of the workers stays for Docling.
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
8. **The agent picks its retrieval model** (`agent_settings.embedding_model`, null meaning the
   default). A self-hosted model is only selectable once the project finished embedding with it,
   and only with the `local-embeddings` flag. When its embedder fails at query time, retrieval falls
   back to the Vertex model with a warning: a slightly less relevant answer beats no answer.
9. **bge-m3 is used dense + sparse**, weighted 1 : 0.3 as in the BGE M3 paper. The embedder runs
   one forward pass and returns the normalised CLS vector and the lexical weights of the model's
   sparse head (`sparse_linear.pt`), computed without the FlagEmbedding library. The weights live
   in `document_chunk_sparse_embedding`, one `sparsevec` row per embedding row, because TypeORM
   cannot map `sparsevec` and would drop such a column on every generated migration, whereas it
   ignores tables without an entity.

## Alternatives

- A long-lived Python subprocess inside the GPU workers, with query embeddings sent through a
  BullMQ queue. It needed no new deployable, but tied the model to the workers (sharing their GPU
  with Docling), made every chat turn depend on a queue round trip, and queued queries behind
  re-embedding batches in a single process.
- An off-the-shelf server (text-embeddings-inference, vLLM) behind an OpenAI-compatible endpoint:
  fast and batched, but without bge-m3's lexical weights. It can still serve a dense-only model of
  the catalog through a thin adapter to the contract.
- A catalog stored in the database and managed from the back-office: adding a model without a
  deploy, but dimensions and sparse heads to validate by hand. Not worth it for a handful of models.

## Consequences

- One more deployable: the embedder, sized on its own (CPU for queries and daily uploads, GPU when
  whole projects are re-embedded). Its image carries the model weights (about 2.3 GB for bge-m3).
- The workers image no longer ships sentence-transformers or any embedding weights.
- Chat turns on a self-hosted model add one HTTP call, bounded by `EMBEDDER_QUERY_TIMEOUT_MS`.
- Locally, the embedder runs in the shared dev compose (`--profile embeddings`), reached by the main
  checkout and every worktree environment, or on the host for Apple Silicon.
- Reverting the migration requires deleting the self-hosted model vectors first; the `down()` does it.
