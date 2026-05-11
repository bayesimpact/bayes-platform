#!/usr/bin/env python3
"""
Parse a document of any supported type with Docling + LlamaIndex DoclingNodeParser and print chunks.

Usage:
  python3 docling_nodes.py --doc-path /path/to/file
  python3 docling_nodes.py --pdf-path /path/to/file  # alias for --doc-path
  python3 docling_nodes.py --docling-version
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
from pathlib import Path
from typing import Any

from llama_index.core.schema import MetadataMode, TextNode


def _resolve_docling_sdk_version() -> str:
    try:
        from importlib.metadata import version

        return version("docling")
    except Exception as error:  # noqa: BLE001
        raise RuntimeError(f"Could not resolve docling package version: {error}") from error


def _import_docling_components() -> tuple[Any, Any]:
    """
    Import DoclingReader and DoclingNodeParser from integration packages.
    """
    import_attempts = [
        (
            ("llama_index.readers.docling", "DoclingReader"),
            ("llama_index.node_parser.docling", "DoclingNodeParser"),
        )
    ]
    import_errors: list[str] = []
    for reader_target, parser_target in import_attempts:
        reader_module_name, reader_class_name = reader_target
        parser_module_name, parser_class_name = parser_target
        try:
            reader_module = __import__(reader_module_name, fromlist=[reader_class_name])
            parser_module = __import__(parser_module_name, fromlist=[parser_class_name])
            return (
                getattr(reader_module, reader_class_name),
                getattr(parser_module, parser_class_name),
            )
        except Exception as error:  # noqa: BLE001
            import_errors.append(
                f"{reader_module_name}.{reader_class_name} + "
                f"{parser_module_name}.{parser_class_name}: {error}"
            )

    raise RuntimeError(
        "Could not import DoclingReader/DoclingNodeParser. Tried:\n"
        + "\n".join(f"- {error_message}" for error_message in import_errors)
        + "\n\nInstall/upgrade likely requirements:\n"
        + "  python3 -m pip install -U "
        + "llama-index-core llama-index-readers-docling "
        + "llama-index-node-parser-docling docling"
    )


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Parse a document with DoclingNodeParser and print chunks to stdout."
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
        help="Print node metadata before each chunk.",
    )
    parser.add_argument(
        "--output-json",
        type=str,
        default=None,
        help=(
            "If set, write nodes to this JSON file path. Use '-' for stdout. "
            "When --output-json is provided, the script will still compute nodes "
            "but will not print every chunk by default."
        ),
    )
    parser.add_argument(
        "--output-stdout",
        action="store_true",
        help="Write nodes JSON to stdout (equivalent to --output-json '-').",
    )
    parser.add_argument(
        "--max-nodes",
        type=int,
        default=None,
        help="If exporting JSON, only include the first N nodes.",
    )
    parser.add_argument(
        "--no-embed-text",
        action="store_true",
        help=(
            "Skip including node.get_content(metadata_mode=MetadataMode.EMBED) "
            "in exported JSON."
        ),
    )
    parser.add_argument(
        "--no-all-content",
        action="store_true",
        help=(
            "Skip including node.get_content(metadata_mode=MetadataMode.ALL) "
            "in exported JSON."
        ),
    )
    return parser.parse_args()


def _collect_runtime_info() -> dict[str, Any]:
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


def _detect_accelerator_device() -> str:
    """
    Return "cuda" when a usable CUDA GPU is available, otherwise "cpu".
    Honors DOCLING_ACCELERATOR_DEVICE env var ("auto" | "cuda" | "cpu" | "mps" | "xpu").
    """
    override = os.environ.get("DOCLING_ACCELERATOR_DEVICE", "auto").strip().lower()
    if override in {"cpu", "cuda", "mps", "xpu"}:
        return override
    try:
        import torch

        if torch.cuda.is_available():
            return "cuda"
    except Exception:  # noqa: BLE001
        pass
    return "cpu"


def _build_doc_converter() -> Any:
    """
    Build a DocumentConverter wired to the detected accelerator (GPU when available).
    Configures both the docling layout/table models (AcceleratorOptions) and the
    RapidOCR engine (rapidocr_params) to use CUDA when applicable.
    """
    from docling.datamodel.accelerator_options import AcceleratorDevice, AcceleratorOptions
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions, RapidOcrOptions
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from rapidocr.utils.typings import EngineType

    device_name = _detect_accelerator_device()
    accelerator_device = AcceleratorDevice(device_name)
    use_cuda = device_name == "cuda"

    rapidocr_params: dict[str, Any] = {
        "Det.engine_type": EngineType.TORCH,
        "Cls.engine_type": EngineType.TORCH,
        "Rec.engine_type": EngineType.TORCH,
        "EngineConfig.torch.use_cuda": use_cuda,
    }

    pipeline_options = PdfPipelineOptions(
        accelerator_options=AcceleratorOptions(device=accelerator_device),
        ocr_options=RapidOcrOptions(rapidocr_params=rapidocr_params),
    )

    print(
        f"[docling_nodes] accelerator device: {device_name} (cuda={use_cuda})",
        file=sys.stderr,
    )

    return DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)},
    )


def _build_markdown_fallback_nodes(documents: list[Any]) -> list[Any]:
    """
    Some Docling documents, notably image-only inputs whose OCR result is a
    single section header, are valid Docling documents but produce no chunks
    through DoclingNodeParser's default HierarchicalChunker. Preserve the
    extracted text by falling back to Docling's markdown export.
    """
    from docling_core.types.doc import DoclingDocument

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
            TextNode(
                text=markdown_text,
                metadata=metadata,
                excluded_embed_metadata_keys=excluded_metadata_keys,
                excluded_llm_metadata_keys=excluded_metadata_keys,
            )
        )

    return fallback_nodes


def main() -> int:
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
    exporting_nodes_json = arguments.output_json is not None

    if not doc_path.exists():
        print(f"Error: Document file does not exist: {doc_path}", file=sys.stderr)
        return 1

    try:
        docling_reader_class, docling_node_parser_class = _import_docling_components()
        doc_converter = _build_doc_converter()
        docling_reader = docling_reader_class(export_type="json", doc_converter=doc_converter)
        docling_node_parser = docling_node_parser_class()
    except Exception as error:  # noqa: BLE001
        print(f"Error initializing DoclingNodeParser:\n{error}", file=sys.stderr)
        return 1

    try:
        started_at = time.perf_counter()
        documents = docling_reader.load_data(file_path=str(doc_path))
        nodes = docling_node_parser.get_nodes_from_documents(documents=documents)
        if not nodes:
            nodes = _build_markdown_fallback_nodes(documents=documents)
        elapsed_ms = int((time.perf_counter() - started_at) * 1000)
    except Exception as error:  # noqa: BLE001
        print(
            "Error while parsing document with DoclingReader/DoclingNodeParser.\n"
            f"Parser type: {type(docling_node_parser)}\n"
            f"Details: {error}",
            file=sys.stderr,
        )
        return 1

    if arguments.output_json != "-":
        runtime_event = {
            "event": "docling_runtime_info",
            "doc_path": str(doc_path),
            "chunk_count": len(nodes),
            "elapsed_ms": elapsed_ms,
            "docling_version": _resolve_docling_sdk_version(),
            "runtime": _collect_runtime_info(),
        }
        print(json.dumps(runtime_event, ensure_ascii=False))

    summary_file = sys.stderr if exporting_nodes_json else sys.stdout
    print(f"Parsed with DoclingNodeParser from: {doc_path}", file=summary_file)
    print(f"Generated {len(nodes)} chunk(s)\n", file=summary_file)

    if arguments.output_json is not None:
        nodes_payload: list[dict[str, Any]] = []
        max_nodes = arguments.max_nodes if arguments.max_nodes is not None else len(nodes)
        for node in nodes[:max_nodes]:
            payload: dict[str, Any] = {
                "node_id": node.node_id,
                "node_type": node.get_type(),
                "metadata": node.metadata,
                "excluded_embed_metadata_keys": getattr(
                    node, "excluded_embed_metadata_keys", []
                ),
            }
            if not arguments.no_embed_text:
                payload["embed_text"] = node.get_content(
                    metadata_mode=MetadataMode.EMBED
                )
            if not arguments.no_all_content:
                payload["all_text"] = node.get_content(metadata_mode=MetadataMode.ALL)
            nodes_payload.append(payload)

        output_json_path = arguments.output_json
        json_text = json.dumps(
            nodes_payload,
            ensure_ascii=False,
            indent=2,
            default=str,
        )
        if output_json_path == "-":
            print(json_text)
        else:
            out_path = Path(output_json_path).expanduser().resolve()
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(json_text, encoding="utf-8")
            print(f"Wrote {len(nodes_payload)} node(s) to: {out_path}")

        return 0

    for chunk_index, node in enumerate(nodes, start=1):
        print(f"--- Node {chunk_index}/{len(nodes)} ---")
        print(node.metadata)
        if arguments.print_metadata:
            print(f"metadata: {getattr(node, 'metadata', {})}")
        if hasattr(node, "get_content"):
            print(node.get_content())
        elif hasattr(node, "text"):
            print(node.text)
        else:
            print(str(node))
        print()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

