import { z } from "zod"
import {
  DOCUMENT_UPLOAD_CONTENT_LENGTH_RANGE_HEADER,
  DOCUMENT_UPLOAD_MAX_BYTES,
  type DocumentEmbeddingStatus,
  isAllowedMimeType,
} from "../../documents/documents.dto"

const documentSourceIdSchema = z.string().uuid()

export const createAppDocumentSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    content: z.string().min(1),
    source_url: z.string().url().optional(),
    document_source_id: documentSourceIdSchema,
  })
  .strict()

export type CreateAppDocumentRequestDto = z.infer<typeof createAppDocumentSchema>

const absoluteHttpUrlSchema = z
  .string()
  .trim()
  .refine((value) => {
    try {
      const parsedUrl = new URL(value)
      return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:"
    } catch {
      return false
    }
  })

export const createAppDocumentUploadSchema = z
  .object({
    file_name: z.string().trim().min(1).max(500),
    mime_type: z.string().refine((mimeType) => isAllowedMimeType(mimeType)),
    size: z.number().int().positive().max(DOCUMENT_UPLOAD_MAX_BYTES),
    title: z.string().trim().min(1).max(500).optional(),
    source_url: absoluteHttpUrlSchema.optional(),
    document_source_id: documentSourceIdSchema,
  })
  .strict()

export type CreateAppDocumentUploadRequestDto = z.infer<typeof createAppDocumentUploadSchema>

const FILE_UPLOAD_FIELDS = ["file_name", "mime_type", "size"] as const

export type ParsedCreateAppDocumentRequest =
  | { kind: "content"; value: CreateAppDocumentRequestDto }
  | { kind: "upload"; value: CreateAppDocumentUploadRequestDto }

export function parseCreateAppDocumentRequest(
  body: unknown,
): { success: true; data: ParsedCreateAppDocumentRequest } | { success: false } {
  if (!isRecord(body)) return { success: false }

  const hasContent = "content" in body
  const hasFileUploadField = FILE_UPLOAD_FIELDS.some((fieldName) => fieldName in body)
  if (hasContent && hasFileUploadField) return { success: false }

  if (hasContent) {
    const parsed = createAppDocumentSchema.safeParse(body)
    if (!parsed.success) return { success: false }
    return { success: true, data: { kind: "content", value: parsed.data } }
  }

  if (hasFileUploadField) {
    const parsed = createAppDocumentUploadSchema.safeParse(body)
    if (!parsed.success) return { success: false }
    return { success: true, data: { kind: "upload", value: parsed.data } }
  }

  return { success: false }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export type AppDocumentCreatedDto = {
  id: string
  title: string
  projectId: string
  sourceUrl: string | null
  embeddingStatus: DocumentEmbeddingStatus
}

export type AppDocumentUploadHeadersDto = {
  "Content-Type": string
  [DOCUMENT_UPLOAD_CONTENT_LENGTH_RANGE_HEADER]: string
}

/** JSON create omits the upload fields. A file upload adds them. */
export type CreateAppDocumentResponseDto = AppDocumentCreatedDto & {
  uploadUrl?: string
  uploadHeaders?: AppDocumentUploadHeadersDto
}
