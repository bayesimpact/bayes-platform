"""Unit tests for apps/api/bin/document_embedder.py (no model download: the loader is mocked)."""

import io
import json
from unittest.mock import MagicMock

import pytest

from document_embedder import ModelRegistry, handle_request, serve


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


def test_handle_request_returns_dimensions_and_embeddings():
    registry, _loader = build_registry(build_fake_model(dimensions=4))

    response = handle_request(
        registry,
        {"id": "r1", "model": "BAAI/bge-m3", "texts": ["hello", "world"], "input_type": "document"},
    )

    assert response == {
        "id": "r1",
        "model": "BAAI/bge-m3",
        "dimensions": 4,
        "embeddings": [[0.1] * 4, [0.1] * 4],
    }


@pytest.mark.parametrize(
    "request_body, expected_error",
    [
        ({"model": "BAAI/bge-m3", "texts": ["x"]}, "missing request id"),
        ({"id": "r", "texts": ["x"]}, "missing model"),
        ({"id": "r", "model": "m", "texts": "x"}, "texts must be a list of strings"),
        ({"id": "r", "model": "m", "texts": ["x"], "input_type": "other"}, "unknown input_type 'other'"),
    ],
)
def test_handle_request_rejects_malformed_requests(request_body, expected_error):
    registry, _loader = build_registry(build_fake_model())

    response = handle_request(registry, request_body)

    assert response["error"] == expected_error


def test_handle_request_reports_model_errors_instead_of_raising():
    registry = ModelRegistry(loader=MagicMock(side_effect=OSError("gated repo")), device="cpu")

    response = handle_request(registry, {"id": "r", "model": "vendor/gated-model", "texts": ["x"]})

    assert response["id"] == "r"
    assert "OSError: gated repo" in response["error"]


def test_serve_answers_one_json_line_per_request_and_skips_blank_lines():
    registry, _loader = build_registry(build_fake_model(dimensions=2))
    stdin = io.StringIO(
        '{"id": "a", "model": "BAAI/bge-m3", "texts": ["x"], "input_type": "query"}\n'
        "\n"
        "not json\n"
        '{"id": "b", "model": "BAAI/bge-m3", "texts": [], "input_type": "document"}\n'
    )
    stdout = io.StringIO()

    serve(registry, stdin, stdout)

    lines = [json.loads(line) for line in stdout.getvalue().splitlines()]
    assert [line["id"] for line in lines] == ["a", None, "b"]
    assert lines[0]["embeddings"] == [[0.1, 0.1]]
    assert lines[1]["error"].startswith("invalid JSON")
    assert lines[2] == {"id": "b", "model": "BAAI/bge-m3", "dimensions": 0, "embeddings": []}
