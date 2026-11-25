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
export type EvaluationExtractionDatasetRecordDto = {
  columnId: string
  columnName: string
  values: unknown[]
}
