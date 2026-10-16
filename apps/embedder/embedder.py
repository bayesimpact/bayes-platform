#!/usr/bin/env python3
"""
Embed texts with a local HuggingFace model through sentence-transformers.

This module holds the models and the encoding; `main.py` serves it over HTTP. Models are loaded
once and kept in memory.

`sparse` is present only for models with a lexical head (bge-m3): one map per text from
vocabulary token id to weight, as defined in the BGE M3 paper (Chen et al., 2024).

Usage:
  python3 embedder.py --version
  python3 embedder.py --prewarm --model BAAI/bge-m3
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any

# bge-m3 accepts 8192 tokens; chunks are far shorter and a lower cap keeps memory flat.
MAX_SEQ_LENGTH_BY_MODEL = {"BAAI/bge-m3": 1024}
# Texts encoded per forward pass. CUDA takes the whole request at once; CPU and Apple
# Silicon stay small to keep memory flat. EMBEDDER_ENCODE_BATCH_SIZE overrides both.
ENCODE_BATCH_SIZE_BY_DEVICE = {"cuda": 128}
DEFAULT_ENCODE_BATCH_SIZE = 32

# Models shipping a lexical (sparse) head next to their dense encoder: file name of the head in
# the HuggingFace repo. bge-m3 projects each token's last hidden state to a weight with it.
SPARSE_HEAD_FILE_BY_MODEL = {"BAAI/bge-m3": "sparse_linear.pt"}


def _resolve_encode_batch_size(device: str) -> int:
    override = os.environ.get("EMBEDDER_ENCODE_BATCH_SIZE")
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
            "  pip install -r apps/embedder/requirements.txt\n"
            f"Error: {error}"
        ) from error


def _resolve_device() -> str:
    override = os.environ.get("EMBEDDER_DEVICE")
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


def pool_sparse_weights(
    input_ids: list[int], token_weights: list[float], ignored_token_ids: set[int]
) -> dict[str, float]:
    """
    Lexical weights of one text, as in BGE M3: keep each vocabulary token once with its highest
    weight, drop special and padding tokens and non-positive weights. Keys are token ids as
    strings (JSON object keys), sorted ascending as pgvector's sparsevec expects.
    """
    best_weight_by_token_id: dict[int, float] = {}
    for token_id, weight in zip(input_ids, token_weights):
        if token_id in ignored_token_ids or weight <= 0:
            continue
        if weight > best_weight_by_token_id.get(token_id, 0.0):
            best_weight_by_token_id[token_id] = float(weight)
    return {str(token_id): best_weight_by_token_id[token_id] for token_id in sorted(best_weight_by_token_id)}


class ModelRegistry:
    """Loads each model once and encodes with the prompt matching the input type."""

    def __init__(self, loader: Any | None = None, device: str | None = None) -> None:
        self._loader = loader
        self._device = device
        self._models: dict[str, Any] = {}
        self._sparse_heads: dict[str, Any] = {}
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

    def has_sparse_head(self, model_name: str) -> bool:
        return model_name in SPARSE_HEAD_FILE_BY_MODEL

    def _get_sparse_head(self, model_name: str, model: Any) -> Any:
        head = self._sparse_heads.get(model_name)
        if head is None:
            import torch
            from huggingface_hub import hf_hub_download

            path = hf_hub_download(model_name, SPARSE_HEAD_FILE_BY_MODEL[model_name])
            state = torch.load(path, map_location="cpu", weights_only=True)
            head = torch.nn.Linear(state["weight"].shape[1], 1)
            head.load_state_dict(state)
            parameter = next(model.parameters())
            head = head.to(parameter.device, dtype=parameter.dtype).eval()
            self._sparse_heads[model_name] = head
        return head

    def encode_dense_and_sparse(
        self, model_name: str, texts: list[str]
    ) -> tuple[list[list[float]], list[dict[str, float]]]:
        """
        One forward pass gives both outputs: the normalised CLS vector (dense, what
        sentence-transformers returns for bge-m3) and the lexical weights of the sparse head.
        bge-m3 uses no instruction prompt, so queries and documents are encoded alike.
        """
        import torch

        model = self.get(model_name)
        head = self._get_sparse_head(model_name, model)
        tokenizer = model[0].tokenizer
        ignored_token_ids = {
            token_id
            for token_id in (
                tokenizer.cls_token_id,
                tokenizer.eos_token_id,
                tokenizer.pad_token_id,
                tokenizer.unk_token_id,
            )
            if token_id is not None
        }
        dense: list[list[float]] = []
        sparse: list[dict[str, float]] = []
        for start in range(0, len(texts), self._encode_batch_size):
            batch = texts[start : start + self._encode_batch_size]
            # sentence-transformers >= 5.2 renamed tokenize to preprocess.
            preprocess = getattr(model, "preprocess", None) or model.tokenize
            features = preprocess(batch)
            features = {
                key: value.to(model.device)
                for key, value in features.items()
                if isinstance(value, torch.Tensor)
            }
            with torch.inference_mode():
                output = model(features)
                token_weights = torch.relu(head(output["token_embeddings"])).squeeze(-1)
            dense.extend(output["sentence_embedding"].float().cpu().tolist())
            for input_ids, weights in zip(
                features["input_ids"].tolist(), token_weights.float().cpu().tolist()
            ):
                sparse.append(pool_sparse_weights(input_ids, weights, ignored_token_ids))
        return dense, sparse

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


class EmbedderError(ValueError):
    """A request the embedder refuses (bad input), as opposed to a model failure."""


def embed_texts(
    registry: ModelRegistry, model_name: str, texts: list[str], input_type: str
) -> dict[str, Any]:
    """Dense vectors for every text, plus lexical weights for models with a sparse head."""
    if input_type not in ("query", "document"):
        raise EmbedderError(f"unknown input_type {input_type!r}")
    if not texts:
        return {"dimensions": 0, "dense": [], "sparse": None}
    sparse: list[dict[str, float]] | None = None
    if registry.has_sparse_head(model_name):
        dense, sparse = registry.encode_dense_and_sparse(model_name, texts)
    else:
        dense = registry.encode(model_name, texts, input_type)
    return {"dimensions": len(dense[0]), "dense": dense, "sparse": sparse}


def prewarm(registry: ModelRegistry, model_names: list[str]) -> None:
    for model_name in model_names:
        # Through embed_texts so the sparse head is downloaded too.
        embed_texts(registry, model_name, ["warm up"], "document")
        print(f"Prewarmed {model_name}", file=sys.stderr, flush=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Local embedding models.")
    parser.add_argument("--version", action="store_true", help="Print the sentence-transformers version.")
    parser.add_argument("--prewarm", action="store_true", help="Download and load the given models.")
    parser.add_argument("--model", action="append", default=[], help="Model id (repeatable).")
    args = parser.parse_args(argv)

    if args.version:
        print(_resolve_sentence_transformers_version())
        return 0

    if args.prewarm:
        if not args.model:
            parser.error("--prewarm needs at least one --model")
        prewarm(ModelRegistry(), args.model)
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
