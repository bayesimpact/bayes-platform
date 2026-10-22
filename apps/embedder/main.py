"""
HTTP embedder for the platform's self-hosted embedding models.

    POST /v1/embed  {"model": "BAAI/bge-m3", "texts": ["..."], "input_type": "query"|"document"}
                    -> {"dimensions": 1024, "dense": [[...]], "sparse": [{"<token id>": w}] | null}
    GET  /healthz   -> {"status": "ok", "models": [...]}

Run with `uvicorn main:create_app --factory --host 0.0.0.0 --port 3003`.

The platform calls the same endpoint for chunks and for chat queries. Queries and document
batches run on separate threads, so a chat turn never waits behind a re-embedding batch.

Configuration (environment):
  EMBEDDER_MODELS        comma-separated models loaded at startup and served (default BAAI/bge-m3)
  EMBEDDER_API_KEY       when set, requests must send `Authorization: Bearer <key>`
  EMBEDDER_MAX_TEXTS     largest batch accepted in one request (default 256)
  EMBEDDER_DEVICE        cuda | mps | cpu, auto-detected when unset
  EMBEDDER_ENCODE_BATCH_SIZE  texts per forward pass (default 128 on CUDA, 32 elsewhere)
"""

from __future__ import annotations

import asyncio
import os
import secrets
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from typing import Any, Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

from embedder import EmbedderError, ModelRegistry, embed_texts, prewarm

DEFAULT_MODELS = "BAAI/bge-m3"
DEFAULT_MAX_TEXTS = 256


class EmbedRequest(BaseModel):
    model: str
    texts: list[str]
    input_type: Literal["query", "document"] = "document"


class EmbedResponse(BaseModel):
    dimensions: int
    dense: list[list[float]]
    sparse: list[dict[str, float]] | None


def _configured_models() -> list[str]:
    raw = os.environ.get("EMBEDDER_MODELS", DEFAULT_MODELS)
    return [model.strip() for model in raw.split(",") if model.strip()]


def create_app(registry: ModelRegistry | None = None, preload: bool = True) -> FastAPI:
    served_models = _configured_models()
    max_texts = int(os.environ.get("EMBEDDER_MAX_TEXTS", DEFAULT_MAX_TEXTS))
    api_key = os.environ.get("EMBEDDER_API_KEY") or None
    model_registry = registry or ModelRegistry()
    # One thread per input type: torch releases the GIL, and a query is not queued behind a batch.
    executors = {
        "query": ThreadPoolExecutor(max_workers=1, thread_name_prefix="embed-query"),
        "document": ThreadPoolExecutor(max_workers=1, thread_name_prefix="embed-document"),
    }

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        if preload:
            # Loads weights and sparse heads before the health check reports ready.
            await asyncio.to_thread(prewarm, model_registry, served_models)
        yield
        for executor in executors.values():
            executor.shutdown(wait=False, cancel_futures=True)

    app = FastAPI(title="Embedder", lifespan=lifespan)

    def check_api_key(authorization: str | None = Header(default=None)) -> None:
        if api_key is None:
            return
        expected = f"Bearer {api_key}"
        if authorization is None or not secrets.compare_digest(authorization, expected):
            raise HTTPException(status_code=401, detail="invalid or missing API key")

    @app.get("/healthz")
    async def healthz() -> dict[str, Any]:
        return {"status": "ok", "models": served_models}

    @app.post("/v1/embed", response_model=EmbedResponse, dependencies=[Depends(check_api_key)])
    async def embed(request: EmbedRequest) -> dict[str, Any]:
        if request.model not in served_models:
            raise HTTPException(status_code=404, detail=f"model {request.model!r} is not served here")
        if len(request.texts) > max_texts:
            raise HTTPException(
                status_code=413, detail=f"at most {max_texts} texts per request, got {len(request.texts)}"
            )
        loop = asyncio.get_running_loop()
        try:
            return await loop.run_in_executor(
                executors[request.input_type],
                embed_texts,
                model_registry,
                request.model,
                request.texts,
                request.input_type,
            )
        except EmbedderError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

    return app

