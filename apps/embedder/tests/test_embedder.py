"""Unit tests for apps/embedder/embedder.py (no model download: the loader is mocked)."""

from unittest.mock import MagicMock

import pytest

from embedder import EmbedderError, ModelRegistry, embed_texts, pool_sparse_weights


def build_fake_model(dimensions: int = 3, with_prompt_methods: bool = True) -> MagicMock:
    model = MagicMock(spec=["encode", "encode_query", "encode_document", "max_seq_length"] if with_prompt_methods else ["encode", "max_seq_length"])
    vector = [0.1] * dimensions

    def encode(texts, **_kwargs):
        return [vector for _ in texts]

    model.encode.side_effect = encode
    if with_prompt_methods:
        model.encode_query.side_effect = encode
        model.encode_document.side_effect = encode
    return model


def build_registry(model: MagicMock) -> tuple[ModelRegistry, MagicMock]:
    loader = MagicMock(return_value=model)
    return ModelRegistry(loader=loader, device="cpu"), loader


def test_loads_each_model_once():
    model = build_fake_model()
    registry, loader = build_registry(model)

    registry.encode("BAAI/bge-m3", ["a"], "document")
    registry.encode("BAAI/bge-m3", ["b"], "document")

    loader.assert_called_once_with("BAAI/bge-m3", device="cpu")
    assert model.max_seq_length == 1024


def test_routes_queries_and_documents_to_the_prompted_encoders():
    model = build_fake_model()
    registry, _loader = build_registry(model)

    registry.encode("vendor/prompted-model", ["q"], "query")
    registry.encode("vendor/prompted-model", ["d"], "document")

    model.encode_query.assert_called_once()
    model.encode_document.assert_called_once()
    model.encode.assert_not_called()
    assert model.encode_query.call_args.kwargs["normalize_embeddings"] is True


def test_falls_back_to_plain_encode_without_prompt_methods():
    model = build_fake_model(with_prompt_methods=False)
    registry, _loader = build_registry(model)

    vectors = registry.encode("BAAI/bge-m3", ["q"], "query")

    model.encode.assert_called_once()
    assert vectors == [[0.1, 0.1, 0.1]]


def test_embed_texts_returns_dimensions_and_dense_vectors():
    registry, _loader = build_registry(build_fake_model(dimensions=4))

    response = embed_texts(registry, "vendor/dense-model", ["hello", "world"], "document")

    assert response == {"dimensions": 4, "dense": [[0.1] * 4, [0.1] * 4], "sparse": None}


def test_embed_texts_returns_nothing_for_no_texts():
    registry, loader = build_registry(build_fake_model())

    assert embed_texts(registry, "BAAI/bge-m3", [], "query") == {
        "dimensions": 0,
        "dense": [],
        "sparse": None,
    }
    loader.assert_not_called()


def test_embed_texts_rejects_an_unknown_input_type():
    registry, _loader = build_registry(build_fake_model())

    with pytest.raises(EmbedderError, match="unknown input_type 'other'"):
        embed_texts(registry, "vendor/dense-model", ["x"], "other")


def test_pool_sparse_weights_keeps_the_max_per_token_and_drops_special_tokens():
    weights = pool_sparse_weights(
        input_ids=[0, 42, 7, 42, 2, 1, 1],
        token_weights=[0.9, 0.1, 0.3, 0.25, 0.8, 0.7, 0.7],
        ignored_token_ids={0, 1, 2},
    )

    assert weights == {"7": 0.3, "42": 0.25}
    assert list(weights) == ["7", "42"]


def test_pool_sparse_weights_drops_non_positive_weights():
    assert pool_sparse_weights([5, 6], [0.0, -0.2], set()) == {}


def test_embed_texts_adds_lexical_weights_for_models_with_a_sparse_head():
    registry, _loader = build_registry(build_fake_model())
    registry.encode_dense_and_sparse = MagicMock(return_value=([[0.1, 0.2]], [{"3": 0.5}]))

    response = embed_texts(registry, "BAAI/bge-m3", ["x"], "query")

    assert response == {"dimensions": 2, "dense": [[0.1, 0.2]], "sparse": [{"3": 0.5}]}
