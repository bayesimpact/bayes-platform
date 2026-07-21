import { PDFReader } from "@llamaindex/readers/pdf"
import {
  Injectable,
  InternalServerErrorException,
  UnsupportedMediaTypeException,
} from "@nestjs/common"
import mammoth from "mammoth"
import {
  extractTextWithDocling,
  getDoclingVersion,
  isDoclingEnabled,
} from "@/external/docling/docling.cli"
import { DOC_MIME_TYPES, DOCLING_SUPPORTED_MIME_TYPES } from "@/external/docling/docling.constants"
import type { DoclingChunk, DoclingParentChunk } from "@/external/docling/docling.types"

const DOCUMENT_CHUNKER_MAX_BUFFER = 50 * 1024 * 1024

const PLAIN_TEXT_MIME_TYPES = new Set(["text/plain", "text/csv", "text/markdown"])

export type DocumentExtractionEngine = string | null

export type DocumentTextExtractionResult = {
  text: string
  chunks?: string[]
  doclingChunks?: DoclingChunk[]
  doclingParentChunks?: DoclingParentChunk[]
  extractionEngine: DocumentExtractionEngine
}

@Injectable()
export class DocumentTextExtractorService {
  async extract(buffer: Buffer, mimeType: string): Promise<DocumentTextExtractionResult> {
    if (isDoclingEnabled() && DOCLING_SUPPORTED_MIME_TYPES.has(mimeType)) {
      const doclingVersion = await getDoclingVersion()
      const { child_chunks, parent_chunks } = await extractTextWithDocling({
        buffer,
        mimeType,
        maxBuffer: DOCUMENT_CHUNKER_MAX_BUFFER,
      })

      const nonEmptyChunks = child_chunks.filter((chunk) => chunk.embed_text.trim().length > 0)

      if (nonEmptyChunks.length === 0) {
        throw new InternalServerErrorException(
          `Docling produced no embed_text chunks for MIME type: ${mimeType}`,
        )
      }

      return {
        text: nonEmptyChunks.map((chunk) => chunk.embed_text.trim()).join("\n"),
        chunks: nonEmptyChunks.map((chunk) => chunk.embed_text.trim()),
        doclingChunks: nonEmptyChunks,
        doclingParentChunks: parent_chunks,
        extractionEngine: `docling@${doclingVersion}`,
      }
    }

    // as a fallback, plain-text formats are decoded straight from the buffer
    if (PLAIN_TEXT_MIME_TYPES.has(mimeType)) {
      return {
        text: buffer.toString("utf-8"),
        extractionEngine: null,
      }
    }

    // as a fallback, we use the PDFReader to extract the text from the PDF
    if (mimeType === "application/pdf") {
      const reader = new PDFReader()
      const docs = await reader.loadDataAsContent(buffer)
      return {
        text: docs.map((documentContent) => documentContent.text).join("\n"),
        extractionEngine: null,
      }
    }

    // as a fallback, we use mammoth to extract the text from the Microsoft document
    if (DOC_MIME_TYPES.has(mimeType)) {
      const result = await mammoth.extractRawText({ buffer })
      return {
        text: result.value,
        extractionEngine: null,
      }
    }

    throw new UnsupportedMediaTypeException(`Cannot extract text from MIME type: ${mimeType}`)
  }
}
