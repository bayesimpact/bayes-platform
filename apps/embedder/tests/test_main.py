"""HTTP contract of apps/embedder/main.py, with a fake model registry (no torch needed)."""

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from main import create_app


def build_client(monkeypatch: pytest.MonkeyPatch, api_key: str | None = None) -> tuple[TestClient, MagicMock]:
    monkeypatch.setenv("EMBEDDER_MODELS", "BAAI/bge-m3")
    monkeypatch.setenv("EMBEDDER_MAX_TEXTS", "2")
    if api_key:
        monkeypatch.setenv("EMBEDDER_API_KEY", api_key)
    else:
        monkeypatch.delenv("EMBEDDER_API_KEY", raising=False)
    registry = MagicMock()
    registry.has_sparse_head.return_value = True
    registry.encode_dense_and_sparse.side_effect = lambda _model, texts: (
        [[0.1, 0.2] for _ in texts],
        [{"7": 0.3} for _ in texts],
    )
    return TestClient(create_app(registry=registry, preload=False)), registry


def test_embeds_texts_with_dense_and_lexical_weights(monkeypatch):
    client, registry = build_client(monkeypatch)

    response = client.post(
        "/v1/embed", json={"model": "BAAI/bge-m3", "texts": ["a", "b"], "input_type": "document"}
    )

    assert response.status_code == 200
    assert response.json() == {
        "dimensions": 2,
        "dense": [[0.1, 0.2], [0.1, 0.2]],
        "sparse": [{"7": 0.3}, {"7": 0.3}],
    }
    registry.encode_dense_and_sparse.assert_called_once_with("BAAI/bge-m3", ["a", "b"])


def test_refuses_a_model_it_does_not_serve(monkeypatch):
    client, _registry = build_client(monkeypatch)

    response = client.post("/v1/embed", json={"model": "vendor/other", "texts": ["a"]})

    assert response.status_code == 404


def test_refuses_a_batch_above_the_limit(monkeypatch):
    client, _registry = build_client(monkeypatch)

    response = client.post("/v1/embed", json={"model": "BAAI/bge-m3", "texts": ["a", "b", "c"]})

    assert response.status_code == 413


def test_refuses_an_unknown_input_type(monkeypatch):
    client, _registry = build_client(monkeypatch)

    response = client.post(
        "/v1/embed", json={"model": "BAAI/bge-m3", "texts": ["a"], "input_type": "other"}
    )

    assert response.status_code == 422


def test_requires_the_api_key_when_one_is_set(monkeypatch):
    client, _registry = build_client(monkeypatch, api_key="secret")
    body = {"model": "BAAI/bge-m3", "texts": ["a"], "input_type": "query"}

    assert client.post("/v1/embed", json=body).status_code == 401
    assert (
        client.post("/v1/embed", json=body, headers={"Authorization": "Bearer wrong"}).status_code
        == 401
    )
    assert (
        client.post("/v1/embed", json=body, headers={"Authorization": "Bearer secret"}).status_code
        == 200
    )


def test_reports_the_served_models(monkeypatch):
    client, _registry = build_client(monkeypatch)

    response = client.get("/healthz")

    assert response.json() == {"status": "ok", "models": ["BAAI/bge-m3"]}
