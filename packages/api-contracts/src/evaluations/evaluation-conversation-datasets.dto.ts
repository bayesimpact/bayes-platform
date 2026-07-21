import { z } from "zod"
import type { TimeType } from "../generic"

// Minimum length UI forms enforce on a dataset name.
export const EVALUATION_CONVERSATION_DATASET_NAME_MIN_LENGTH = 3

export const evaluationConversationDatasetNameSchema = z.object({
  name: z.string().trim(),
})

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

export type BulkCreateEvaluationConversationDatasetRecordsRequestDto = {
  records: CreateEvaluationConversationDatasetRecordRequestDto[]
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
