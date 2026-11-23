import { MimeTypes } from "@caseai-connect/api-contracts"
import type {
  ExtractionDocumentOutputDto,
  ExtractionRunDetailOutputDto,
  ExtractionRunOutputDto,
} from "@caseai-connect/desk-contracts"
import type { ExtractionAgentSessionsService } from "@/domains/agents/extraction-agent-sessions/extraction-agent-sessions.service"
import type { DocumentsService } from "@/domains/documents/documents.service"

/** An extraction run as the service gives it, with its settings and its document. */
export type ExtractionRunRecord = Awaited<
  ReturnType<ExtractionAgentSessionsService["listRuns"]>
>[number]

/**
 * A run of the history, as the Desk reads it. A copy of the `toSummaryDto` of
 * `ExtractionAgentSessionsController`, limited to the fields of the contract.
 */
export function toExtractionRunDto(run: ExtractionRunRecord): ExtractionRunOutputDto {
  return {
    id: run.id,
    documentId: run.documentId,
    documentFileName: run.document?.fileName ?? null,
    status: run.status,
    createdAt: run.createdAt.getTime(),
    updatedAt: run.updatedAt.getTime(),
  }
}

/**
 * One run with what the agent read in it. A copy of the `toDto` of
 * `ExtractionAgentSessionsController`, limited to the fields of the contract.
 */
export function toExtractionRunDetailDto(run: ExtractionRunRecord): ExtractionRunDetailOutputDto {
  return {
    id: run.id,
    documentId: run.documentId,
    status: run.status,
    result: run.result,
    errorCode: run.errorCode,
    errorDetails: run.errorDetails,
    createdAt: run.createdAt.getTime(),
    updatedAt: run.updatedAt.getTime(),
  }
}

/** A document as the service gives it. */
export type ExtractionDocumentRecord = NonNullable<
  Awaited<ReturnType<DocumentsService["findById"]>>
>

/**
 * A document the person uploaded for a run, as the Desk reads it: the fields of the contract of
 * the `toDocumentDto` of the documents domain.
 */
export function toExtractionDocumentDto(
  document: ExtractionDocumentRecord,
): ExtractionDocumentOutputDto {
  return {
    id: document.id,
    fileName: document.fileName,
    mimeType: document.mimeType,
    size: document.size,
    language: document.language === "fr" ? "fr" : "en",
    content: document.content ?? null,
    createdAt: document.createdAt.getTime(),
    updatedAt: document.updatedAt.getTime(),
  }
}

/**
 * The API's own name for a MIME type the contract accepts. The contract lists plain strings, the
 * service reads its enum: the lookup tells the compiler they match, with no cast.
 */
export function toMimeType(value: string): MimeTypes {
  const mimeType = Object.values(MimeTypes).find((candidate) => candidate === value)
  if (!mimeType) throw new Error(`The MIME type ${value} is not one the API knows`)
  return mimeType
}
