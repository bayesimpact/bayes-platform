import type { TimeType } from "../generic"

// EVALUATION DATASET
export type EvaluationConversationDatasetDto = {
  createdAt: TimeType
  id: string
  name: string
  projectId: string
  recordCount: number
  updatedAt: TimeType
}

// DATASET RECORD
export type EvaluationConversationDatasetRecordDto = {
  createdAt: TimeType
  expectedOutput: string
  id: string
  input: string
  updatedAt: TimeType
}

// Request DTOs
export type CreateEvaluationConversationDatasetRecordRequestDto = {
  expectedOutput: string
  input: string
}

export type UpdateEvaluationConversationDatasetRecordRequestDto = {
  expectedOutput: string
  input: string
}

// PAGINATED RECORDS
export type PaginatedEvaluationConversationDatasetRecordsDto = {
  records: EvaluationConversationDatasetRecordDto[]
  total: number
  page: number
  limit: number
}
