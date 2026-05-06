#!/usr/bin/env python3
"""
Parse a document of any supported type with Docling + LlamaIndex DoclingNodeParser
(backed by HybridChunker) and print chunks with relationship metadata.

Each output chunk includes:
  - chunk_id       : stable UUID assigned to this chunk
  - embed_text     : contextualized text (headings prepended) suitable for embedding
  - text           : raw chunk text without metadata
  - parent_id      : chunk_id of the nearest ancestor heading chunk, or null
  - prev_chunk_id  : chunk_id of the immediately preceding chunk, or null
  - next_chunk_id  : chunk_id of the immediately following chunk, or null
  - headings       : list of heading strings that contextualize this chunk
  - captions       : list of caption strings associated with this chunk
  - metadata       : full LlamaIndex node metadata dict (includes doc_items, origin, etc.)

Usage:
  python3 document_chunker.py --doc-path /path/to/file
  python3 document_chunker.py --pdf-path /path/to/file  # alias for --doc-path
  python3 document_chunker.py --docling-version
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import time
import uuid as uuid_module
from pathlib import Path
from typing import Any


def _resolve_docling_sdk_version() -> str:
    """Return the installed Docling SDK version string via importlib.metadata."""
    try:
        from importlib.metadata import version

        return version("docling")
    except Exception as error:  # noqa: BLE001
        raise RuntimeError(f"Could not resolve docling package version: {error}") from error


def _import_docling_components() -> tuple[Any, Any, Any, Any, Any]:
    """
    Lazily import all heavy Docling/LlamaIndex components so that lightweight
    flags such as --docling-version work even when the ML packages are absent.

    Returns:
        A 4-tuple of (DoclingReader, DoclingNodeParser, HybridChunker, MetadataMode).

    Raises:
        RuntimeError: If any of the required packages cannot be imported.
    """
    import_errors: list[str] = []

    try:
        from llama_index.readers.docling import DoclingReader
        from llama_index.node_parser.docling import DoclingNodeParser
        from llama_index.core.schema import MetadataMode, TextNode
        from docling.chunking import HybridChunker

        return DoclingReader, DoclingNodeParser, HybridChunker, MetadataMode, TextNode
    except Exception as error:  # noqa: BLE001
        import_errors.append(str(error))

    raise RuntimeError(
        "Could not import required Docling/LlamaIndex components. Error(s):\n"
        + "\n".join(f"- {e}" for e in import_errors)
        + "\n\nInstall/upgrade likely requirements:\n"
        + "  python3 -m pip install -U "
        + "docling llama-index-core llama-index-readers-docling "
        + "llama-index-node-parser-docling"
    )


def _enrich_nodes(
    nodes: list[Any],
    metadata_mode_none: Any,
    metadata_mode_embed: Any,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Assign UUIDs, synthesize section-level parent chunks, and compute
    parent/prev/next relationships for an ordered list of LlamaIndex TextNode
    objects produced by DoclingNodeParser.

    Parent chunk strategy — small-to-big:
        Chunks sharing the same headings tuple form a section group.

        Single-chunk sections: the chunk already represents the full section.
          No parent is synthesized; parent_id=None.

        Multi-chunk sections: a synthetic parent chunk is prepended to the
          group. It carries no text or embed_text. Every child chunk's parent_id
          points to this synthetic parent.

        This avoids duplicating text while enabling small-to-big retrieval:
        retrieve a precise paragraph chunk, then look up its parent_id to find
        sibling chunks (those sharing the same parent_id) for full-section context.

    prev_chunk_id and next_chunk_id operate within independent navigation lanes:
    child chunks link only to adjacent child chunks; synthetic parent chunks link
    only to adjacent synthetic parent chunks. This keeps section-level and
    paragraph-level traversal separate.

    Args:
        nodes: Ordered list of LlamaIndex TextNode objects.
        metadata_mode_none: MetadataMode.NONE — produces raw text only.
        metadata_mode_embed: MetadataMode.EMBED — produces contextualized text for embedding.

    Returns:
        A (child_chunks, parent_chunks) tuple.

        Child chunks have keys: chunk_id, embed_text, text, parent_id,
        prev_chunk_id, next_chunk_id, headings, captions, metadata.

        Parent chunks have keys: chunk_id, embed_text, text, prev_chunk_id,
        next_chunk_id, headings, captions. text is the full section text
        (all child texts joined); embed_text prepends headings to that text.
    """
    # Pass 1: group node indices by headings tuple, preserving document order.
    groups: dict[tuple[str, ...], list[int]] = {}
    for index, node in enumerate(nodes):
        headings_key = tuple(h.strip() for h in (node.metadata.get("headings") or []))
        if headings_key not in groups:
            groups[headings_key] = []
        groups[headings_key].append(index)

    # Pass 2: assign a UUID to every child node and generate a synthetic parent
    # UUID for each group that contains more than one node.
    child_ids: list[str] = [str(uuid_module.uuid4()) for _ in nodes]
    synthetic_parent_ids: dict[tuple[str, ...], str] = {
        key: str(uuid_module.uuid4())
        for key, indices in groups.items()
        if len(indices) > 1
    }

    # Pass 3: build child and parent lists.
    child_items: list[dict[str, Any]] = []
    parent_items: list[dict[str, Any]] = []

    for index, node in enumerate(nodes):
        headings: list[str] = node.metadata.get("headings") or []
        captions: list[str] = node.metadata.get("captions") or []
        headings_key = tuple(h.strip() for h in headings)
        child_id = child_ids[index]
        synthetic_id = synthetic_parent_ids.get(headings_key)

        group_indices = groups[headings_key]
        is_first_in_group = group_indices[0] == index

        if is_first_in_group and synthetic_id is not None:
            full_text = "\n\n".join(
                nodes[i].get_content(metadata_mode_none) for i in group_indices
            )
            heading_prefix = "\n".join(headings)
            parent_embed_text = (heading_prefix + "\n\n" + full_text) if headings else full_text
            parent_items.append(
                {
                    "chunk_id": synthetic_id,
                    "embed_text": parent_embed_text,
                    "text": full_text,
                    "prev_chunk_id": None,  # filled in final sweep
                    "next_chunk_id": None,  # filled in final sweep
                    "headings": headings,
                    "captions": captions,
                }
            )

        raw_text = node.get_content(metadata_mode_none)
        child_items.append(
            {
                "chunk_id": child_id,
                "embed_text": node.get_content(metadata_mode_embed),
                "text": raw_text,
                "parent_id": synthetic_id,
                "prev_chunk_id": None,  # filled in final sweep
                "next_chunk_id": None,  # filled in final sweep
                "headings": headings,
                "captions": captions,
                "metadata": node.metadata,
            }
        )

    # Final sweep: fill prev_chunk_id / next_chunk_id within each lane.
    for lane in (child_items, parent_items):
        total = len(lane)
        for position, item in enumerate(lane):
            item["prev_chunk_id"] = lane[position - 1]["chunk_id"] if position > 0 else None
            item["next_chunk_id"] = lane[position + 1]["chunk_id"] if position < total - 1 else None

    return child_items, parent_items


def parse_arguments() -> argparse.Namespace:
    """
    Define and parse the CLI interface for this script.

    Returns:
        A Namespace object with attributes for each registered flag.
    """
    parser = argparse.ArgumentParser(
        description=(
            "Parse a document with Docling HybridChunker (via DoclingNodeParser) "
            "and print chunks with parent/prev/next relationship IDs to stdout."
        )
    )
    parser.add_argument(
        "--doc-path",
        "--pdf-path",
        dest="doc_path",
        help="Absolute or relative path to a supported document type.",
    )
    parser.add_argument(
        "--docling-version",
        action="store_true",
        help="Print the installed Docling SDK version and exit.",
    )
    parser.add_argument(
        "--print-metadata",
        action="store_true",
        help="In human-readable mode, print headings/captions and relationship IDs before each chunk.",
    )
    parser.add_argument(
        "--output-json",
        type=str,
        default=None,
        help=(
            "If set, write chunks to this JSON file path. Use '-' for stdout. "
            "When --output-json is provided the script computes chunks but does "
            "not print each one individually by default."
        ),
    )
    parser.add_argument(
        "--output-stdout",
        action="store_true",
        help="Write chunks JSON to stdout (equivalent to --output-json '-').",
    )
    parser.add_argument(
        "--max-nodes",
        type=int,
        default=None,
        help="If exporting JSON, only include the first N chunks.",
    )
    parser.add_argument(
        "--no-embed-text",
        action="store_true",
        help="Skip including embed_text in exported JSON.",
    )
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=None,
        help=(
            "Maximum number of tokens per chunk for HybridChunker. "
            "Defaults to the tokenizer's built-in limit (256 for the default tokenizer)."
        ),
    )
    return parser.parse_args()


def _collect_runtime_info() -> dict[str, Any]:
    """
    Gather platform and GPU diagnostics for the runtime_info event log entry.

    Returns:
        Dict with keys: python_version, platform, cuda_visible_devices,
        nvidia_smi_available, and optionally nvidia_smi_output / nvidia_smi_error.
    """
    runtime_info: dict[str, Any] = {
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "cuda_visible_devices": os.environ.get("CUDA_VISIBLE_DEVICES"),
    }

    nvidia_smi_path = shutil.which("nvidia-smi")
    runtime_info["nvidia_smi_available"] = nvidia_smi_path is not None

    if nvidia_smi_path is None:
        return runtime_info

    try:
        nvidia_smi_result = subprocess.run(
            [
                nvidia_smi_path,
                "--query-gpu=name,driver_version,memory.total,memory.used",
                "--format=csv,noheader",
            ],
            capture_output=True,
            text=True,
            check=False,
            timeout=5,
        )
        runtime_info["nvidia_smi_exit_code"] = nvidia_smi_result.returncode
        runtime_info["nvidia_smi_output"] = nvidia_smi_result.stdout.strip()
        if nvidia_smi_result.stderr.strip():
            runtime_info["nvidia_smi_stderr"] = nvidia_smi_result.stderr.strip()
    except Exception as error:  # noqa: BLE001
        runtime_info["nvidia_smi_error"] = str(error)

    return runtime_info


def _chunk_with_llama_index(
    text: str,
    max_tokens: int | None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    from llama_index.core.node_parser import SentenceSplitter
    from llama_index.core.schema import Document as LlamaDocument

    chunk_size = max_tokens if max_tokens is not None else 512
    splitter = SentenceSplitter(chunk_size=chunk_size, chunk_overlap=0)
    nodes = splitter.get_nodes_from_documents([LlamaDocument(text=text)])

    child_chunks: list[dict[str, Any]] = []
    for node in nodes:
        child_chunks.append(
            {
                "chunk_id": str(uuid_module.uuid4()),
                "embed_text": node.get_content(),
                "text": node.get_content(),
                "parent_id": None,
                "prev_chunk_id": None,
                "next_chunk_id": None,
                "headings": [],
                "captions": [],
                "metadata": {},
            }
        )

    total = len(child_chunks)
    for position, chunk in enumerate(child_chunks):
        chunk["prev_chunk_id"] = child_chunks[position - 1]["chunk_id"] if position > 0 else None
        chunk["next_chunk_id"] = child_chunks[position + 1]["chunk_id"] if position < total - 1 else None

    return child_chunks, []


def _chunk_tabular(
    doc_path: Path,
    max_tokens: int | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    import pandas as pd

    # Character budget: max_tokens * 4 as a rough approximation (1 token ≈ 4 chars).
    char_budget = (max_tokens if max_tokens is not None else 512) * 4
    suffix = doc_path.suffix.lower()
    if suffix == ".csv":
        df = pd.read_csv(doc_path, sep=None, engine="python", on_bad_lines="skip")
    else:
        df = pd.read_excel(doc_path)

    columns = df.columns.tolist()
    child_chunks: list[dict[str, Any]] = []
    batch_rows: list[list[Any]] = []
    batch_chars = 0

    def _flush(rows: list[list[Any]]) -> None:
        text = pd.DataFrame(rows, columns=columns).to_string(index=False)
        child_chunks.append(
            {
                "chunk_id": str(uuid_module.uuid4()),
                "embed_text": text,
                "text": text,
                "parent_id": None,
                "prev_chunk_id": None,
                "next_chunk_id": None,
                "headings": [],
                "captions": [],
                "metadata": {"columns": columns},
            }
        )

    for _, row in df.iterrows():
        row_chars = len("  ".join(str(v) for v in row.values))
        if batch_rows and batch_chars + row_chars > char_budget:
            _flush(batch_rows)
            batch_rows = []
            batch_chars = 0
        batch_rows.append(row.values.tolist())
        batch_chars += row_chars
        # single row exceeds budget — flush immediately so it becomes its own chunk
        if batch_chars > char_budget:
            _flush(batch_rows)
            batch_rows = []
            batch_chars = 0

    if batch_rows:
        _flush(batch_rows)

    total = len(child_chunks)
    for position, chunk in enumerate(child_chunks):
        chunk["prev_chunk_id"] = child_chunks[position - 1]["chunk_id"] if position > 0 else None
        chunk["next_chunk_id"] = child_chunks[position + 1]["chunk_id"] if position < total - 1 else None

    return child_chunks, []


def _chunk_plain_text(
    doc_path: Path,
    max_tokens: int | None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    text = doc_path.read_text(encoding="utf-8", errors="replace")
    return _chunk_with_llama_index(text, max_tokens)


def _build_markdown_fallback_nodes(documents: list[Any], text_node_class: Any) -> list[Any]:
    """
    Some Docling documents, notably image-only inputs whose OCR result is a
    single section header, are valid Docling documents but produce no chunks
    through DoclingNodeParser's default HierarchicalChunker. Preserve the
    extracted text by falling back to Docling's markdown export.
    """
    from docling_core.types.doc.document import DoclingDocument

    fallback_nodes: list[Any] = []
    for document_index, document in enumerate(documents):
        document_content = (
            document.get_content() if hasattr(document, "get_content") else document.text
        )
        docling_document = DoclingDocument.model_validate_json(document_content)
        markdown_text = docling_document.export_to_markdown(image_placeholder="").strip()

        if not markdown_text:
            continue

        metadata = {
            "docling_parse_mode": "markdown_fallback",
            "docling_document_index": document_index,
        }
        excluded_metadata_keys = list(metadata.keys())
        fallback_nodes.append(
            text_node_class(
                text=markdown_text,
                metadata=metadata,
                excluded_embed_metadata_keys=excluded_metadata_keys,
                excluded_llm_metadata_keys=excluded_metadata_keys,
            )
        )

    return fallback_nodes


def main() -> int:
    """
    Entry point: parse arguments, load and chunk the document, then write output.

    Returns:
        0 on success, 1 on any error.
    """
    arguments = parse_arguments()

    if arguments.docling_version:
        try:
            print(_resolve_docling_sdk_version())
            return 0
        except Exception as error:  # noqa: BLE001
            print(f"Error resolving Docling version: {error}", file=sys.stderr)
            return 1

    if not arguments.doc_path:
        print("Error: --doc-path is required unless --docling-version is used", file=sys.stderr)
        return 1

    doc_path = Path(arguments.doc_path)

    if arguments.output_stdout:
        arguments.output_json = "-"
    exporting_chunks_json = arguments.output_json is not None

    if not doc_path.exists():
        print(f"Error: Document file does not exist: {doc_path}", file=sys.stderr)
        return 1

    suffix = doc_path.suffix.lower()
    is_tabular = suffix in (".csv", ".xlsx", ".xls")
    is_plain_text = suffix == ".txt"

    try:
        started_at = time.perf_counter()
        if is_tabular:
            child_chunks, parent_chunks = _chunk_tabular(doc_path, arguments.max_tokens)
        elif is_plain_text:
            child_chunks, parent_chunks = _chunk_plain_text(doc_path, arguments.max_tokens)
        else:
            (
                docling_reader_class,
                docling_node_parser_class,
                hybrid_chunker_class,
                metadata_mode_class,
                text_node_class,
            ) = _import_docling_components()
            docling_reader = docling_reader_class(export_type="json")
            chunker = (
                hybrid_chunker_class(max_tokens=arguments.max_tokens)
                if arguments.max_tokens is not None
                else hybrid_chunker_class()
            )
            docling_node_parser = docling_node_parser_class(chunker=chunker)
            documents = docling_reader.load_data(file_path=str(doc_path))
            nodes = docling_node_parser.get_nodes_from_documents(documents=documents)
            if not nodes:
                nodes = _build_markdown_fallback_nodes(documents=documents, text_node_class=text_node_class)
            child_chunks, parent_chunks = _enrich_nodes(
                nodes=nodes,
                metadata_mode_none=metadata_mode_class.NONE,
                metadata_mode_embed=metadata_mode_class.EMBED,
            )
        elapsed_ms = int((time.perf_counter() - started_at) * 1000)
    except Exception as error:  # noqa: BLE001
        print(
            f"Error while parsing document.\nDetails: {error}",
            file=sys.stderr,
        )
        return 1

    total_count = len(child_chunks) + len(parent_chunks)

    if arguments.output_json != "-":
        runtime_event: dict[str, Any] = {
            "event": "chunker_runtime_info",
            "doc_path": str(doc_path),
            "pipeline": "pandas+llama-index" if is_tabular else ("llama-index/sentence-splitter" if is_plain_text else "docling/hybrid-chunker"),
            "child_chunk_count": len(child_chunks),
            "parent_chunk_count": len(parent_chunks),
            "elapsed_ms": elapsed_ms,
            "runtime": _collect_runtime_info(),
        }
        if not is_tabular and not is_plain_text:
            runtime_event["docling_version"] = _resolve_docling_sdk_version()
        print(json.dumps(runtime_event, ensure_ascii=False))

    if is_tabular:
        pipeline_label = "pandas+llama-index (tabular)"
    elif is_plain_text:
        pipeline_label = "LlamaIndex SentenceSplitter (plain text)"
    else:
        pipeline_label = "Docling HybridChunker"
    summary_file = sys.stderr if exporting_chunks_json else sys.stdout
    print(f"Parsed with {pipeline_label} from: {doc_path}", file=summary_file)
    print(f"Generated {len(child_chunks)} child chunk(s) and {len(parent_chunks)} parent chunk(s)\n", file=summary_file)

    if arguments.output_json is not None:
        max_nodes = arguments.max_nodes

        def _build_child_payload(chunk: dict[str, Any]) -> dict[str, Any]:
            payload: dict[str, Any] = {
                "chunk_id": chunk["chunk_id"],
                "text": chunk["text"],
                "parent_id": chunk["parent_id"],
                "prev_chunk_id": chunk["prev_chunk_id"],
                "next_chunk_id": chunk["next_chunk_id"],
                "headings": chunk["headings"],
                "captions": chunk["captions"],
                "metadata": chunk["metadata"],
            }
            if not arguments.no_embed_text:
                payload["embed_text"] = chunk["embed_text"]
            return payload

        def _build_parent_payload(chunk: dict[str, Any]) -> dict[str, Any]:
            payload: dict[str, Any] = {
                "chunk_id": chunk["chunk_id"],
                "text": chunk["text"],
                "prev_chunk_id": chunk["prev_chunk_id"],
                "next_chunk_id": chunk["next_chunk_id"],
                "headings": chunk["headings"],
                "captions": chunk["captions"],
            }
            if not arguments.no_embed_text:
                payload["embed_text"] = chunk["embed_text"]
            return payload

        output_payload: dict[str, Any] = {
            "child_chunks": [_build_child_payload(c) for c in (child_chunks[:max_nodes] if max_nodes else child_chunks)],
            "parent_chunks": [_build_parent_payload(c) for c in (parent_chunks[:max_nodes] if max_nodes else parent_chunks)],
        }

        output_json_path = arguments.output_json
        json_text = json.dumps(output_payload, ensure_ascii=False, indent=2, default=str)
        if output_json_path == "-":
            print(json_text)
        else:
            out_path = Path(output_json_path).expanduser().resolve()
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(json_text, encoding="utf-8")
            print(f"Wrote {len(output_payload['child_chunks'])} child chunk(s) and {len(output_payload['parent_chunks'])} parent chunk(s) to: {out_path}")

        return 0

    all_chunks = []
    for chunk in child_chunks:
        all_chunks.append((chunk, False))
    for chunk in parent_chunks:
        all_chunks.append((chunk, True))

    for chunk_index, (chunk, is_parent) in enumerate(all_chunks, start=1):
        print(f"--- Chunk {chunk_index}/{total_count} {'[parent]' if is_parent else ''} ---")
        if arguments.print_metadata:
            print(f"headings:       {chunk['headings']}")
            print(f"captions:       {chunk['captions']}")
            if not is_parent:
                print(f"parent_id:      {chunk['parent_id']}")
            print(f"prev_chunk_id:  {chunk['prev_chunk_id']}")
            print(f"next_chunk_id:  {chunk['next_chunk_id']}")
        print(chunk["embed_text"])
        print()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
