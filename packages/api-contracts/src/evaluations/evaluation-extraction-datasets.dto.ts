import type { MimeTypes } from "../documents/documents.dto"
import type { TimeType } from "../generic"

// DATASET FILE
/** A CSV uploaded to build datasets from. Only confirmed uploads are listed. */
export type EvaluationExtractionDatasetFileDto = {
  createdAt: TimeType
  fileName: string
  id: string
  mimeType: MimeTypes
  projectId: string
  size: number
  storageRelativePath: string
  updatedAt: TimeType
}
export type PresignEvaluationExtractionDatasetFileRequestDto = {
  fileName: string
  mimeType: MimeTypes
  size: number
}
export type PresignEvaluationExtractionDatasetFileResponseDto = {
  documentId: string
  uploadUrl: string
}
export type EvaluationExtractionDatasetFileColumnDto = {
  id: string
  name: string
  values: string[]
}

// EVALUATION DATASET
export const EVALUATION_EXTRACTION_DATASET_SCHEMA_COLUMN_ROLES = [
  "target",
  "input",
  "reference",
  "ignore",
] as const
export type EvaluationExtractionDatasetSchemaColumnRoleDto =
  (typeof EVALUATION_EXTRACTION_DATASET_SCHEMA_COLUMN_ROLES)[number]
export type EvaluationExtractionDatasetSchemaColumnDto = {
  finalName: string
  id: string
  index: number
  originalName: string
  role: EvaluationExtractionDatasetSchemaColumnRoleDto
}
export type EvaluationExtractionDatasetSchemaMappingDto = Record<
  EvaluationExtractionDatasetSchemaColumnDto["id"],
  EvaluationExtractionDatasetSchemaColumnDto
>
export type EvaluationExtractionDatasetRecordDto = {
  columnId: string
  columnName: string
  values: unknown[]
}
export type EvaluationExtractionDatasetDto = {
  createdAt: TimeType
  /** The file the records were built from, null until the dataset is initialized. */
  documentId: string | null
  id: string
  name: string
  projectId: string
  recordCount: number
  schemaMapping: EvaluationExtractionDatasetSchemaMappingDto
  updatedAt: TimeType
}

// PAGINATED RECORDS
export type EvaluationExtractionDatasetRecordRowDto = {
  id: string
  data: Record<string, unknown>
}
export type PaginatedEvaluationExtractionDatasetRecordsDto = {
  records: EvaluationExtractionDatasetRecordRowDto[]
  total: number
  page: number
  limit: number
}
