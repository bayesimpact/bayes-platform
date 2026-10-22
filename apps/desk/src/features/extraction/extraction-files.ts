import { EXTRACTION_MAX_BYTES, EXTRACTION_MIME_TYPES } from "@caseai-connect/desk-contracts"

type ExtractionMimeType = (typeof EXTRACTION_MIME_TYPES)[number]

/** The kind of file an extraction reads, which picks its icon and how it runs. */
export type FileKind = "pdf" | "image" | "text" | "csv" | "other"

/**
 * The type of a file, by its extension when the browser names none or another one: macOS gives
 * Markdown no type, and Windows calls a CSV file `application/vnd.ms-excel`.
 */
const TYPES_BY_EXTENSION: Record<string, ExtractionMimeType> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
}

const isExtractionMimeType = (type: string): type is ExtractionMimeType =>
  EXTRACTION_MIME_TYPES.some((mimeType) => mimeType === type)

/** The type the API takes for a file, or `null` when an extraction cannot read it. */
export function extractionMimeTypeOf(file: {
  name: string
  type: string
}): ExtractionMimeType | null {
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? ""
  const byExtension = TYPES_BY_EXTENSION[extension]
  if (byExtension === "text/csv") return byExtension
  if (isExtractionMimeType(file.type)) return file.type
  return byExtension ?? null
}

/** Why a file cannot be read, or `null` when it can. */
export function fileProblemOf(file: File): "type" | "size" | "empty" | null {
  if (extractionMimeTypeOf(file) === null) return "type"
  if (file.size === 0) return "empty"
  if (file.size > EXTRACTION_MAX_BYTES) return "size"
  return null
}

/** The kind of a file, from its type or, when the API knows none, its name. */
export function fileKindOf(file: { mimeType?: string; fileName?: string | null }): FileKind {
  const type =
    file.mimeType && isExtractionMimeType(file.mimeType)
      ? file.mimeType
      : extractionMimeTypeOf({ name: file.fileName ?? "", type: file.mimeType ?? "" })
  if (type === "application/pdf") return "pdf"
  if (type === "text/csv") return "csv"
  if (type?.startsWith("image/")) return "image"
  if (type?.startsWith("text/")) return "text"
  return "other"
}
