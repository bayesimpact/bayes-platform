# Embedder

HTTP service serving the platform's self-hosted embedding models (BAAI/bge-m3 for now) with
sentence-transformers. The API and the workers call it for document chunks and for chat queries
alike; they never run a model themselves. See ADR 0028.

## Contract

```
POST /v1/embed
Authorization: Bearer <EMBEDDER_API_KEY>      (only when the key is set)
{ "model": "BAAI/bge-m3", "texts": ["..."], "input_type": "query" | "document" }

200 { "dimensions": 1024, "dense": [[...]], "sparse": [{ "<token id>": 0.12 }] | null }
```

- `dense` holds one normalised vector per text, in request order.
- `sparse` holds the lexical weights of models with a sparse head (bge-m3), one map per text from
  vocabulary token id to weight. It is `null` for dense-only models.
- `404` for a model the service does not serve, `413` above `EMBEDDER_MAX_TEXTS` texts, `401` for
  a missing or wrong key.

`GET /healthz` answers once the models are loaded.

Any server that honours this contract can stand in for this one. On the platform side, a model is
offered once `EMBEDDER_<MODEL>_URL` is set on the API and the workers (`EMBEDDER_BGE_M3_URL`).

## Configuration

| Variable | Default | |
|---|---|---|
| `EMBEDDER_MODELS` | `BAAI/bge-m3` | Models loaded at startup and served, comma-separated |
| `EMBEDDER_API_KEY` | unset | Required bearer token when set |
| `EMBEDDER_MAX_TEXTS` | `256` | Largest batch accepted in one request |
| `EMBEDDER_DEVICE` | auto | `cuda`, `mps` or `cpu` |
| `EMBEDDER_ENCODE_BATCH_SIZE` | `128` on CUDA, `32` elsewhere | Texts per forward pass |
| `PORT` | `3003` | |

Queries and document batches run on two separate threads, so a chat turn does not wait behind a
re-embedding batch.

## Running it locally

With Docker, shared by the main checkout and every worktree environment:

```bash
docker compose -f infra/database/docker-compose.yaml --profile embeddings up -d embedder
```

On the host, to use Apple Silicon (`mps`), which Docker cannot reach:

```bash
cd apps/embedder
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env-example .env
```

`npm run dev` at the repository root then starts it on port 3003 (it skips the service when
`.venv` is missing). Set `EMBEDDER_BGE_M3_URL=http://localhost:3003` in `apps/api/.env`.

On CPU, bge-m3 embeds a query in a fraction of a second but a large project's chunks take a while:
fine on a laptop, a GPU is worth it for production re-embeddings.

## Image

```bash
docker build -f apps/embedder/Dockerfile -t embedder .
# GPU (CUDA 12.8 torch wheels):
docker build -f apps/embedder/Dockerfile --build-arg TORCH_INDEX_URL=https://download.pytorch.org/whl/cu128 -t embedder-gpu .
```

The model weights are baked into the image at build time.

## Tests

```bash
cd apps/embedder
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/pytest -q
```

The tests use a fake model registry and need no torch.
