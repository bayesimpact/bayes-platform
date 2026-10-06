#!/usr/bin/env python3
"""
Embed texts with a local HuggingFace model through sentence-transformers.

The GPU workers keep one instance of this script alive (`--serve`) and talk to it over JSON
lines: one request object per line on stdin, one response object per line on stdout. Models are
loaded on first use and kept in memory.

Request:  {"id": "...", "model": "BAAI/bge-m3", "texts": ["..."], "input_type": "query"|"document"}
Response: {"id": "...", "model": "...", "dimensions": 1024, "embeddings": [[...], ...]}
      or  {"id": "...", "error": "..."}

Usage:
  python3 document_embedder.py --version
  python3 document_embedder.py --prewarm --model BAAI/bge-m3
  python3 document_embedder.py --serve
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

# bge-m3 accepts 8192 tokens; chunks are far shorter and a lower cap keeps memory flat.
MAX_SEQ_LENGTH_BY_MODEL = {"BAAI/bge-m3": 1024}
# Texts encoded per forward pass. CUDA takes the whole request at once; CPU and Apple
# Silicon stay small to keep memory flat. LOCAL_EMBEDDING_ENCODE_BATCH_SIZE overrides both.
ENCODE_BATCH_SIZE_BY_DEVICE = {"cuda": 128}
DEFAULT_ENCODE_BATCH_SIZE = 32


def _resolve_encode_batch_size(device: str) -> int:
    override = os.environ.get("LOCAL_EMBEDDING_ENCODE_BATCH_SIZE")
    if override:
        return int(override)
    return ENCODE_BATCH_SIZE_BY_DEVICE.get(device.split(":")[0], DEFAULT_ENCODE_BATCH_SIZE)


def _resolve_sentence_transformers_version() -> str:
    try:
        from importlib.metadata import version

        return version("sentence-transformers")
    except Exception as error:  # noqa: BLE001
        raise RuntimeError(f"Could not resolve sentence-transformers version: {error}") from error


def _import_sentence_transformer() -> Any:
    """Lazy import so `--version` and the unit tests work without torch installed."""
    try:
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer
    except Exception as error:  # noqa: BLE001
        raise RuntimeError(
            "Could not import sentence_transformers. Install with:\n"
            "  pip install -r apps/api/requirements-embeddings.txt\n"
            f"Error: {error}"
        ) from error


def _resolve_device() -> str:
    override = os.environ.get("LOCAL_EMBEDDING_DEVICE")
    if override:
        return override
    try:
        import torch

        if torch.cuda.is_available():
            return "cuda"
        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return "mps"
    except Exception:  # noqa: BLE001
        pass
    return "cpu"


class ModelRegistry:
    """Loads each model once and encodes with the prompt matching the input type."""

    def __init__(self, loader: Any | None = None, device: str | None = None) -> None:
        self._loader = loader
        self._device = device
        self._models: dict[str, Any] = {}
        self._encode_batch_size = _resolve_encode_batch_size(device or _resolve_device())

    def get(self, model_name: str) -> Any:
        model = self._models.get(model_name)
        if model is None:
            model = self._load(model_name)
            self._models[model_name] = model
        return model

    def _load(self, model_name: str) -> Any:
        loader = self._loader or _import_sentence_transformer()
        device = self._device or _resolve_device()
        print(f"Loading {model_name} on {device}", file=sys.stderr, flush=True)
        model = loader(model_name, device=device)
        max_seq_length = MAX_SEQ_LENGTH_BY_MODEL.get(model_name)
        if max_seq_length is not None:
            try:
                model.max_seq_length = max_seq_length
            except Exception:  # noqa: BLE001
                pass
        return model

    def encode(self, model_name: str, texts: list[str], input_type: str) -> list[list[float]]:
        model = self.get(model_name)
        encode_kwargs = {
            "batch_size": self._encode_batch_size,
            "normalize_embeddings": True,
            "convert_to_numpy": True,
        }
        # sentence-transformers >= 5 exposes encode_query / encode_document, which apply the
        # model's own prompts (prompt-trained models need them). Older models simply ignore prompts.
        if input_type == "query" and hasattr(model, "encode_query"):
            vectors = model.encode_query(texts, **encode_kwargs)
        elif input_type == "document" and hasattr(model, "encode_document"):
            vectors = model.encode_document(texts, **encode_kwargs)
        else:
            vectors = model.encode(texts, **encode_kwargs)
        return [[float(value) for value in vector] for vector in vectors]


def handle_request(registry: ModelRegistry, request: dict[str, Any]) -> dict[str, Any]:
    request_id = request.get("id")
    model_name = request.get("model")
    texts = request.get("texts")
    input_type = request.get("input_type", "document")
    if not isinstance(request_id, str) or not request_id:
        return {"id": request_id, "error": "missing request id"}
    if not isinstance(model_name, str) or not model_name:
        return {"id": request_id, "error": "missing model"}
    if not isinstance(texts, list) or not all(isinstance(text, str) for text in texts):
        return {"id": request_id, "error": "texts must be a list of strings"}
    if input_type not in ("query", "document"):
        return {"id": request_id, "error": f"unknown input_type {input_type!r}"}
    try:
        embeddings = registry.encode(model_name, texts, input_type)
    except Exception as error:  # noqa: BLE001
        return {"id": request_id, "error": f"{type(error).__name__}: {error}"}
    dimensions = len(embeddings[0]) if embeddings else 0
    return {
        "id": request_id,
        "model": model_name,
        "dimensions": dimensions,
        "embeddings": embeddings,
    }


def serve(registry: ModelRegistry, stdin: Any, stdout: Any) -> None:
    for raw_line in stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError as error:
            response: dict[str, Any] = {"id": None, "error": f"invalid JSON: {error}"}
        else:
            response = handle_request(registry, request)
        stdout.write(json.dumps(response) + "\n")
        stdout.flush()


def prewarm(registry: ModelRegistry, model_names: list[str]) -> None:
    for model_name in model_names:
        registry.encode(model_name, ["warm up"], "document")
        print(f"Prewarmed {model_name}", file=sys.stderr, flush=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Local embeddings server for the GPU workers.")
    parser.add_argument("--version", action="store_true", help="Print the sentence-transformers version.")
    parser.add_argument("--serve", action="store_true", help="Read JSONL requests from stdin.")
    parser.add_argument("--prewarm", action="store_true", help="Download and load the given models.")
    parser.add_argument("--model", action="append", default=[], help="Model id (repeatable).")
    args = parser.parse_args(argv)

    if args.version:
        print(_resolve_sentence_transformers_version())
        return 0

    registry = ModelRegistry()
    if args.prewarm:
        if not args.model:
            parser.error("--prewarm needs at least one --model")
        prewarm(registry, args.model)
        return 0

    if args.serve:
        serve(registry, sys.stdin, sys.stdout)
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
