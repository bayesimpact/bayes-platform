"""
Tests for document_chunker.py.

Unit tests cover _enrich_nodes() in isolation using lightweight mock objects —
no Docling installation required for these.

Integration tests run the full pipeline against PDF fixtures in test/fixtures/
and require Docling + LlamaIndex to be installed.
"""

from __future__ import annotations

import importlib.util
import uuid
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _make_mock_node(
    text: str,
    headings: list[str] | None = None,
    captions: list[str] | None = None,
    embed_text: str | None = None,
) -> MagicMock:
    """
    Build a minimal LlamaIndex TextNode mock with the metadata shape that
    DoclingNodeParser produces: node.text, node.metadata, and node.get_content().

    get_content(FAKE_NONE) returns raw text; get_content(FAKE_EMBED) returns
    embed_text if provided, otherwise raw text.
    """
    node = MagicMock()
    node.text = text
    node.metadata = {}
    if headings is not None:
        node.metadata["headings"] = headings
    if captions is not None:
        node.metadata["captions"] = captions

    resolved_embed = embed_text if embed_text is not None else text
    node.get_content.side_effect = lambda mode: resolved_embed if str(mode) == "MetadataMode.EMBED" else text
    return node


FAKE_NONE = MagicMock(__str__=lambda self: "MetadataMode.NONE")
FAKE_EMBED = MagicMock(__str__=lambda self: "MetadataMode.EMBED")


def _enrich(nodes: list[MagicMock]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Convenience wrapper — returns (child_chunks, parent_chunks)."""
    from document_chunker import _enrich_nodes

    return _enrich_nodes(nodes, FAKE_NONE, FAKE_EMBED)


# ---------------------------------------------------------------------------
# Unit tests — _enrich_nodes()
# ---------------------------------------------------------------------------


class TestEnrichNodesIds:
    def test_chunk_ids_are_unique(self) -> None:
        """Every chunk receives a distinct UUID."""
        nodes = [_make_mock_node(f"text {i}") for i in range(5)]
        child_chunks, parent_chunks = _enrich(nodes)
        ids = [c["chunk_id"] for c in child_chunks + parent_chunks]
        assert len(ids) == len(set(ids))

    def test_chunk_ids_are_valid_uuids(self) -> None:
        """Every chunk_id parses as a valid UUID."""
        nodes = [_make_mock_node(f"text {i}") for i in range(3)]
        child_chunks, parent_chunks = _enrich(nodes)
        for chunk in child_chunks + parent_chunks:
            uuid.UUID(chunk["chunk_id"])


class TestEnrichNodesPrevNext:
    def test_first_child_chunk_has_no_prev(self) -> None:
        """The first child chunk always has prev_chunk_id=None."""
        nodes = [_make_mock_node(f"text {i}") for i in range(3)]
        child_chunks, _ = _enrich(nodes)
        assert child_chunks[0]["prev_chunk_id"] is None

    def test_last_child_chunk_has_no_next(self) -> None:
        """The last child chunk always has next_chunk_id=None."""
        nodes = [_make_mock_node(f"text {i}") for i in range(3)]
        child_chunks, _ = _enrich(nodes)
        assert child_chunks[-1]["next_chunk_id"] is None

    def test_child_prev_next_links_only_to_child_chunks(self) -> None:
        """Child prev/next must link only to adjacent child chunks."""
        nodes = [
            _make_mock_node("A1", headings=["Section A"]),
            _make_mock_node("A2", headings=["Section A"]),
            _make_mock_node("B1", headings=["Section B"]),
        ]
        child_chunks, _ = _enrich(nodes)
        child_id_set = {c["chunk_id"] for c in child_chunks}
        for child in child_chunks:
            if child["prev_chunk_id"] is not None:
                assert child["prev_chunk_id"] in child_id_set
            if child["next_chunk_id"] is not None:
                assert child["next_chunk_id"] in child_id_set

    def test_child_linkage_is_consistent(self) -> None:
        """child[i].next_chunk_id == child[i+1].chunk_id for all interior positions."""
        nodes = [
            _make_mock_node("A1", headings=["Section A"]),
            _make_mock_node("A2", headings=["Section A"]),
            _make_mock_node("B1", headings=["Section B"]),
            _make_mock_node("B2", headings=["Section B"]),
        ]
        child_chunks, _ = _enrich(nodes)
        for i in range(len(child_chunks) - 1):
            assert child_chunks[i]["next_chunk_id"] == child_chunks[i + 1]["chunk_id"]
            assert child_chunks[i + 1]["prev_chunk_id"] == child_chunks[i]["chunk_id"]

    def test_parent_prev_next_links_only_to_other_parents(self) -> None:
        """Parent prev/next must link only to adjacent parent chunks."""
        nodes = [
            _make_mock_node("A1", headings=["Section A"]),
            _make_mock_node("A2", headings=["Section A"]),
            _make_mock_node("B1", headings=["Section B"]),
            _make_mock_node("B2", headings=["Section B"]),
        ]
        _, parent_chunks = _enrich(nodes)
        parent_id_set = {c["chunk_id"] for c in parent_chunks}
        assert len(parent_chunks) == 2
        assert parent_chunks[0]["prev_chunk_id"] is None
        assert parent_chunks[1]["next_chunk_id"] is None
        assert parent_chunks[0]["next_chunk_id"] == parent_chunks[1]["chunk_id"]
        assert parent_chunks[1]["prev_chunk_id"] == parent_chunks[0]["chunk_id"]
        for parent in parent_chunks:
            if parent["prev_chunk_id"] is not None:
                assert parent["prev_chunk_id"] in parent_id_set
            if parent["next_chunk_id"] is not None:
                assert parent["next_chunk_id"] in parent_id_set

    def test_single_chunk_has_no_prev_or_next(self) -> None:
        """A single-element list produces prev_chunk_id=None and next_chunk_id=None."""
        child_chunks, _ = _enrich([_make_mock_node("only chunk")])
        assert child_chunks[0]["prev_chunk_id"] is None
        assert child_chunks[0]["next_chunk_id"] is None


class TestEnrichNodesParent:
    def test_single_chunk_section_has_no_parent(self) -> None:
        """A single chunk in a heading group has parent_id=None."""
        child_chunks, _ = _enrich([_make_mock_node("Only paragraph.", headings=["Introduction"])])
        assert child_chunks[0]["parent_id"] is None

    def test_single_chunk_section_creates_no_parent_chunk(self) -> None:
        """A single chunk in a heading group produces no parent chunk."""
        _, parent_chunks = _enrich([_make_mock_node("Only paragraph.", headings=["Introduction"])])
        assert len(parent_chunks) == 0

    def test_multi_chunk_section_creates_one_parent(self) -> None:
        """Two chunks sharing the same headings produce exactly one parent chunk."""
        nodes = [
            _make_mock_node("First paragraph.", headings=["Introduction"]),
            _make_mock_node("Second paragraph.", headings=["Introduction"]),
        ]
        _, parent_chunks = _enrich(nodes)
        assert len(parent_chunks) == 1

    def test_child_chunks_point_to_parent(self) -> None:
        """All child chunks in a multi-chunk section share the same parent_id."""
        nodes = [_make_mock_node(f"Para {i}.", headings=["Section"]) for i in range(4)]
        child_chunks, parent_chunks = _enrich(nodes)
        parent_id = parent_chunks[0]["chunk_id"]
        for child in child_chunks:
            assert child["parent_id"] == parent_id

    def test_parent_has_no_parent_id_field(self) -> None:
        """Parent chunks do not carry a parent_id field."""
        nodes = [_make_mock_node("A.", headings=["Section"]), _make_mock_node("B.", headings=["Section"])]
        _, parent_chunks = _enrich(nodes)
        assert "parent_id" not in parent_chunks[0]

    def test_parent_text_is_joined_children_text(self) -> None:
        """Parent text is the concatenation of all child texts separated by double newlines."""
        nodes = [
            _make_mock_node("First paragraph.", headings=["Section"]),
            _make_mock_node("Second paragraph.", headings=["Section"]),
        ]
        _, parent_chunks = _enrich(nodes)
        assert parent_chunks[0]["text"] == "First paragraph.\n\nSecond paragraph."

    def test_parent_embed_text_prepends_headings(self) -> None:
        """Parent embed_text is headings joined then full section text."""
        nodes = [
            _make_mock_node("Para A.", headings=["Chapter", "Section"]),
            _make_mock_node("Para B.", headings=["Chapter", "Section"]),
        ]
        _, parent_chunks = _enrich(nodes)
        assert parent_chunks[0]["embed_text"] == "Chapter\nSection\n\nPara A.\n\nPara B."

    def test_parent_embed_text_no_headings(self) -> None:
        """Parent embed_text equals full text when there are no headings."""
        nodes = [_make_mock_node("Para A."), _make_mock_node("Para B.")]
        _, parent_chunks = _enrich(nodes)
        assert parent_chunks[0]["embed_text"] == "Para A.\n\nPara B."

    def test_different_heading_groups_do_not_share_parent(self) -> None:
        """Chunks from different heading groups get no parent."""
        nodes = [
            _make_mock_node("Para A.", headings=["Section A"]),
            _make_mock_node("Para B.", headings=["Section B"]),
        ]
        child_chunks, _ = _enrich(nodes)
        assert child_chunks[0]["parent_id"] is None
        assert child_chunks[1]["parent_id"] is None

    def test_chunk_is_never_its_own_parent(self) -> None:
        """No child chunk has parent_id equal to its own chunk_id."""
        nodes = [_make_mock_node(f"Para {i}.", headings=["Section"]) for i in range(3)]
        child_chunks, _ = _enrich(nodes)
        for child in child_chunks:
            assert child["parent_id"] != child["chunk_id"]


class TestEnrichNodesContent:
    def test_text_and_embed_text_are_distinct(self) -> None:
        """text is raw content; embed_text may differ (e.g. with heading context)."""
        node = _make_mock_node("raw text", embed_text="heading\n\nraw text")
        child_chunks, _ = _enrich([node])
        assert child_chunks[0]["text"] == "raw text"
        assert child_chunks[0]["embed_text"] == "heading\n\nraw text"

    def test_headings_and_captions_are_propagated(self) -> None:
        """headings and captions from metadata are surfaced as top-level fields."""
        node = _make_mock_node("text", headings=["H1", "H2"], captions=["Fig. 1"])
        child_chunks, _ = _enrich([node])
        assert child_chunks[0]["headings"] == ["H1", "H2"]
        assert child_chunks[0]["captions"] == ["Fig. 1"]

    def test_missing_headings_and_captions_default_to_empty_list(self) -> None:
        """Nodes with no headings/captions metadata produce empty lists, not None."""
        node = _make_mock_node("text")
        child_chunks, _ = _enrich([node])
        assert child_chunks[0]["headings"] == []
        assert child_chunks[0]["captions"] == []

    def test_parent_carries_headings_and_captions(self) -> None:
        """Parent chunks surface the headings and captions of their section."""
        nodes = [
            _make_mock_node("A.", headings=["Section"], captions=["Fig. 1"]),
            _make_mock_node("B.", headings=["Section"], captions=["Fig. 1"]),
        ]
        _, parent_chunks = _enrich(nodes)
        assert parent_chunks[0]["headings"] == ["Section"]
        assert parent_chunks[0]["captions"] == ["Fig. 1"]


# ---------------------------------------------------------------------------
# Integration tests — full pipeline against test/fixtures/sample.pdf
# ---------------------------------------------------------------------------

docling_available = pytest.mark.skipif(
    not (FIXTURES_DIR / "sample.pdf").exists(),
    reason="sample.pdf fixture not found",
)

docling_installed = pytest.mark.skipif(
    importlib.util.find_spec("docling") is None,
    reason="docling not installed",
)


# ---------------------------------------------------------------------------
# Adaptive OCR — PDF text-layer classifier and forced full-page OCR wiring.
# Some scan-to-PDF pipelines draw page content as vector glyph outlines (no
# text layer, no bitmap images); docling's bitmap-coverage OCR trigger never
# fires on those, producing empty output unless full-page OCR is forced.
# ---------------------------------------------------------------------------


def _build_vector_only_pdf_bytes() -> bytes:
    """
    Build a minimal one-page PDF whose only content is filled vector paths —
    no text operators, no embedded images. This reproduces the "vector-path
    scan" failure mode: 0% bitmap coverage and 0 native text characters.
    """
    content = b"0 0 m 100 0 l 100 100 l 0 100 l h f 120 10 m 140 30 l 160 10 l h f"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>",
        b"<< /Length %d >>\nstream\n%s\nendstream" % (len(content), content),
    ]
    pdf = bytearray(b"%PDF-1.4\n")
    offsets: list[int] = []
    for object_number, object_body in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf += b"%d 0 obj\n" % object_number + object_body + b"\nendobj\n"
    xref_position = len(pdf)
    pdf += b"xref\n0 %d\n" % (len(objects) + 1)
    pdf += b"0000000000 65535 f \n"
    for offset in offsets:
        pdf += b"%010d 00000 n \n" % offset
    pdf += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objects) + 1,
        xref_position,
    )
    return bytes(pdf)


@pytest.fixture(scope="session")
def vector_only_pdf(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """A PDF with vector-drawn content only: no text layer, no bitmap images."""
    pdf_path = tmp_path_factory.mktemp("adaptive_ocr") / "vector_only.pdf"
    pdf_path.write_bytes(_build_vector_only_pdf_bytes())
    return pdf_path


@docling_installed
class TestPdfTextLayerClassifier:
    def test_vector_only_pdf_is_flagged(self, vector_only_pdf: Path) -> None:
        """A PDF with no native text layer must be flagged for forced OCR."""
        from document_chunker import _pdf_has_no_usable_text_layer

        assert _pdf_has_no_usable_text_layer(vector_only_pdf) is True

    @docling_available
    def test_native_text_pdf_is_not_flagged(self) -> None:
        """A PDF with a real text layer keeps the default (fast) pipeline."""
        from document_chunker import _pdf_has_no_usable_text_layer

        assert _pdf_has_no_usable_text_layer(FIXTURES_DIR / "sample.pdf") is False

    def test_unreadable_pdf_falls_back_to_default(self, tmp_path: Path) -> None:
        """Classification errors must never break conversion — default path wins."""
        from document_chunker import _pdf_has_no_usable_text_layer

        broken_pdf = tmp_path / "broken.pdf"
        broken_pdf.write_bytes(b"this is not a pdf at all")
        assert _pdf_has_no_usable_text_layer(broken_pdf) is False


@docling_installed
class TestForceOcrConverter:
    def test_force_flag_is_set_on_nested_ocr_options(self) -> None:
        """The converter must carry force_full_page_ocr on ocr_options."""
        from docling.datamodel.base_models import InputFormat
        from document_chunker import _build_force_ocr_pdf_converter

        converter = _build_force_ocr_pdf_converter()
        pipeline_options = converter.format_to_options[InputFormat.PDF].pipeline_options
        assert pipeline_options.do_ocr is True
        assert pipeline_options.ocr_options.force_full_page_ocr is True

    def test_pdf_pipeline_options_kwarg_is_still_silently_dropped(self) -> None:
        """
        Pin the upstream trap that motivates _build_force_ocr_pdf_converter:
        force_full_page_ocr passed to PdfPipelineOptions(...) is discarded by
        pydantic without error. If this ever starts failing, docling fixed it
        upstream and the builder can be simplified.
        """
        from docling.datamodel.pipeline_options import PdfPipelineOptions

        options = PdfPipelineOptions(do_ocr=True, force_full_page_ocr=True)
        assert not hasattr(options, "force_full_page_ocr")
        assert options.ocr_options.force_full_page_ocr is False


vector_scan_available = pytest.mark.skipif(
    not (FIXTURES_DIR / "test-1.pdf").exists(),
    reason="test-1.pdf fixture not found",
)


def _run_adaptive_pipeline(pdf_path: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]], bool]:
    """
    Run the same docling branch main() runs — adaptive reader selection,
    parsing, markdown fallback, enrichment. Returns
    (child_chunks, parent_chunks, forced_full_page_ocr).
    """
    from document_chunker import (
        _build_markdown_fallback_nodes,
        _create_docling_reader,
        _enrich_nodes,
        _import_docling_components,
    )

    (
        docling_reader_class,
        docling_node_parser_class,
        hybrid_chunker_class,
        metadata_mode_class,
        text_node_class,
    ) = _import_docling_components()
    reader, forced = _create_docling_reader(docling_reader_class, pdf_path)
    parser = docling_node_parser_class(chunker=hybrid_chunker_class())
    documents = reader.load_data(file_path=str(pdf_path))
    nodes = parser.get_nodes_from_documents(documents=documents)
    if not nodes:
        nodes = _build_markdown_fallback_nodes(documents=documents, text_node_class=text_node_class)
    child_chunks, parent_chunks = _enrich_nodes(
        nodes=nodes,
        metadata_mode_none=metadata_mode_class.NONE,
        metadata_mode_embed=metadata_mode_class.EMBED,
    )
    return child_chunks, parent_chunks, forced


@docling_installed
@vector_scan_available
class TestIntegrationVectorScanPdf:
    """
    test/fixtures/test-1.pdf is a real scan-to-PDF whose pages are drawn
    entirely as vector paths: zero native text, zero bitmap coverage. Without
    forced full-page OCR, docling extracts (almost) nothing from it.
    """

    def test_classifier_flags_it(self) -> None:
        from document_chunker import _pdf_has_no_usable_text_layer

        assert _pdf_has_no_usable_text_layer(FIXTURES_DIR / "test-1.pdf") is True

    def test_default_pipeline_extracts_almost_nothing(self) -> None:
        """
        Pin the failure mode this feature exists for. If this starts failing
        because the default pipeline recovers real text, docling fixed its OCR
        trigger upstream and the adaptive forcing may no longer be needed.
        """
        from document_chunker import _import_docling_components

        docling_reader_class, *_ = _import_docling_components()
        reader = docling_reader_class(export_type="json")
        documents = reader.load_data(file_path=str(FIXTURES_DIR / "test-1.pdf"))
        total_chars = sum(len(document.get_content()) for document in documents)
        # export_type="json" content is the DoclingDocument JSON, which is
        # non-empty even for an empty page — check the actual text instead.
        from docling_core.types.doc.document import DoclingDocument

        markdown = "".join(
            DoclingDocument.model_validate_json(document.get_content()).export_to_markdown(
                image_placeholder=""
            )
            for document in documents
        )
        assert total_chars > 0  # documents load fine — the text is just missing
        assert len(markdown.strip()) < 100

    def test_adaptive_pipeline_recovers_the_text(self) -> None:
        child_chunks, _parent_chunks, forced = _run_adaptive_pipeline(FIXTURES_DIR / "test-1.pdf")
        assert forced is True
        assert len(child_chunks) > 0
        total_text = "\n".join(chunk["text"] for chunk in child_chunks)
        assert len(total_text) > 1000


@docling_installed
class TestCreateDoclingReader:
    def test_textless_pdf_gets_a_forcing_converter(self, vector_only_pdf: Path) -> None:
        from llama_index.readers.docling import DoclingReader

        from document_chunker import _create_docling_reader

        reader, forced = _create_docling_reader(DoclingReader, vector_only_pdf)
        assert forced is True
        assert reader.doc_converter is not None

    @docling_available
    def test_native_text_pdf_keeps_default_reader(self) -> None:
        from llama_index.readers.docling import DoclingReader

        from document_chunker import _create_docling_reader

        _reader, forced = _create_docling_reader(DoclingReader, FIXTURES_DIR / "sample.pdf")
        assert forced is False

    def test_non_pdf_documents_are_never_classified(self, tmp_path: Path) -> None:
        """Only PDFs go through the text-layer classifier."""
        from llama_index.readers.docling import DoclingReader

        from document_chunker import _create_docling_reader

        docx_path = tmp_path / "sample.docx"
        docx_path.write_bytes(b"irrelevant")
        _reader, forced = _create_docling_reader(DoclingReader, docx_path)
        assert forced is False


def _run_pipeline(pdf_path: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Run the full Docling pipeline and return (child_chunks, parent_chunks)."""
    from document_chunker import _enrich_nodes, _import_docling_components

    (
        docling_reader_class,
        docling_node_parser_class,
        hybrid_chunker_class,
        metadata_mode_class,
        _text_node_class,
    ) = _import_docling_components()
    reader = docling_reader_class(export_type="json")
    parser = docling_node_parser_class(chunker=hybrid_chunker_class())
    documents = reader.load_data(file_path=str(pdf_path))
    nodes = parser.get_nodes_from_documents(documents=documents)
    return _enrich_nodes(
        nodes=nodes,
        metadata_mode_none=metadata_mode_class.NONE,
        metadata_mode_embed=metadata_mode_class.EMBED,
    )


def _assert_lane_integrity(
    child_chunks: list[dict[str, Any]],
    parent_chunks: list[dict[str, Any]],
) -> None:
    """Assert that each lane forms a valid non-cyclic linked list and parent_ids are valid."""
    child_id_set = {c["chunk_id"] for c in child_chunks}
    parent_id_set = {c["chunk_id"] for c in parent_chunks}

    for i, chunk in enumerate(child_chunks):
        expected_prev = child_chunks[i - 1]["chunk_id"] if i > 0 else None
        expected_next = child_chunks[i + 1]["chunk_id"] if i < len(child_chunks) - 1 else None
        assert chunk["prev_chunk_id"] == expected_prev
        assert chunk["next_chunk_id"] == expected_next

    for i, chunk in enumerate(parent_chunks):
        expected_prev = parent_chunks[i - 1]["chunk_id"] if i > 0 else None
        expected_next = parent_chunks[i + 1]["chunk_id"] if i < len(parent_chunks) - 1 else None
        assert chunk["prev_chunk_id"] == expected_prev
        assert chunk["next_chunk_id"] == expected_next

    for chunk in child_chunks:
        if chunk.get("parent_id") is not None:
            assert chunk["parent_id"] in parent_id_set

    for chunk in parent_chunks:
        assert "parent_id" not in chunk
        _ = child_id_set  # parents reference children only via parent_id on child side


@pytest.fixture(scope="class")
def sample_pdf_result() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Run the Docling pipeline once for sample.pdf and share the result across the test class."""
    return _run_pipeline(FIXTURES_DIR / "sample.pdf")


@docling_available
class TestIntegrationSamplePdf:
    def test_produces_multiple_child_chunks(self, sample_pdf_result: tuple) -> None:
        child_chunks, _ = sample_pdf_result
        assert len(child_chunks) > 1

    def test_chunk_ids_are_valid_uuids(self, sample_pdf_result: tuple) -> None:
        child_chunks, parent_chunks = sample_pdf_result
        for chunk in child_chunks + parent_chunks:
            uuid.UUID(chunk["chunk_id"])

    def test_lane_integrity(self, sample_pdf_result: tuple) -> None:
        child_chunks, parent_chunks = sample_pdf_result
        _assert_lane_integrity(child_chunks, parent_chunks)

    def test_at_least_one_child_has_a_parent(self, sample_pdf_result: tuple) -> None:
        child_chunks, _ = sample_pdf_result
        assert any(c["parent_id"] is not None for c in child_chunks)

    def test_at_least_one_parent_chunk_exists(self, sample_pdf_result: tuple) -> None:
        _, parent_chunks = sample_pdf_result
        assert len(parent_chunks) > 0

    def test_child_embed_text_is_non_empty(self, sample_pdf_result: tuple) -> None:
        child_chunks, _ = sample_pdf_result
        for chunk in child_chunks:
            assert isinstance(chunk["embed_text"], str) and chunk["embed_text"].strip()

    def test_parent_embed_text_is_non_empty(self, sample_pdf_result: tuple) -> None:
        _, parent_chunks = sample_pdf_result
        for chunk in parent_chunks:
            assert isinstance(chunk["embed_text"], str) and chunk["embed_text"].strip()

    def test_parent_text_contains_child_texts(self, sample_pdf_result: tuple) -> None:
        """Each parent's text must contain the text of all its children."""
        child_chunks, parent_chunks = sample_pdf_result
        children_by_parent: dict[str, list[str]] = {}
        for child in child_chunks:
            if child["parent_id"] is not None:
                children_by_parent.setdefault(child["parent_id"], []).append(child["text"])
        parent_by_id = {p["chunk_id"]: p for p in parent_chunks}
        for parent_id, child_texts in children_by_parent.items():
            parent_text = parent_by_id[parent_id]["text"]
            for child_text in child_texts:
                assert child_text in parent_text


# ---------------------------------------------------------------------------
# Integration tests — tabular pipeline against test/fixtures/sample.csv
# ---------------------------------------------------------------------------


csv_available = pytest.mark.skipif(
    not (FIXTURES_DIR / "sample.csv").exists(),
    reason="sample.csv fixture not found",
)


@pytest.fixture(scope="class")
def sample_csv_result() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Run the tabular chunker once for sample.csv and share across the test class."""
    from document_chunker import _chunk_tabular

    return _chunk_tabular(FIXTURES_DIR / "sample.csv")


@csv_available
class TestIntegrationSampleCsv:
    def test_produces_at_least_one_chunk(self, sample_csv_result: tuple) -> None:
        child_chunks, _ = sample_csv_result
        assert len(child_chunks) >= 1

    def test_produces_no_parent_chunks(self, sample_csv_result: tuple) -> None:
        """Tabular chunking is flat — every chunk is a child with no parent."""
        _, parent_chunks = sample_csv_result
        assert parent_chunks == []

    def test_chunk_ids_are_valid_uuids(self, sample_csv_result: tuple) -> None:
        child_chunks, _ = sample_csv_result
        for chunk in child_chunks:
            uuid.UUID(chunk["chunk_id"])

    def test_no_child_has_a_parent(self, sample_csv_result: tuple) -> None:
        child_chunks, _ = sample_csv_result
        assert all(chunk["parent_id"] is None for chunk in child_chunks)

    def test_chunks_carry_column_metadata(self, sample_csv_result: tuple) -> None:
        """Every CSV chunk should expose the source column list in its metadata."""
        child_chunks, _ = sample_csv_result
        expected_columns = ["id", "name", "department", "salary"]
        for chunk in child_chunks:
            assert chunk["metadata"]["columns"] == expected_columns

    def test_text_and_embed_text_match(self, sample_csv_result: tuple) -> None:
        """For tabular chunks there is no heading prefix to add."""
        child_chunks, _ = sample_csv_result
        for chunk in child_chunks:
            assert chunk["text"] == chunk["embed_text"]
            assert chunk["text"].strip()

    def test_lane_integrity(self, sample_csv_result: tuple) -> None:
        child_chunks, parent_chunks = sample_csv_result
        _assert_lane_integrity(child_chunks, parent_chunks)

    def test_chunks_contain_source_row_values(self, sample_csv_result: tuple) -> None:
        """The concatenated chunk text must mention every source row's name."""
        child_chunks, _ = sample_csv_result
        full_text = "\n".join(chunk["text"] for chunk in child_chunks)
        for name in ("Alice Martin", "Eve Johnson", "Julia Rossi"):
            assert name in full_text


class TestChunkTabularBudget:
    """Unit tests for _chunk_tabular's character-budget splitting behaviour."""

    def test_small_budget_splits_into_multiple_chunks(self) -> None:
        """A tight token budget forces multiple chunks for a 10-row CSV."""
        from document_chunker import _chunk_tabular

        # max_tokens=8 -> char budget ~= 32, single row already exceeds.
        child_chunks, _ = _chunk_tabular(FIXTURES_DIR / "sample.csv", max_tokens=8)
        assert len(child_chunks) > 1

    def test_large_budget_fits_in_one_chunk(self) -> None:
        """A generous budget keeps every row in a single chunk."""
        from document_chunker import _chunk_tabular

        child_chunks, _ = _chunk_tabular(FIXTURES_DIR / "sample.csv", max_tokens=4096)
        assert len(child_chunks) == 1
