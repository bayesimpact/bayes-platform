import { z } from "zod"
import type { TimeType } from "../generic"

// Minimum length UI forms enforce on a dataset name.
export const EVALUATION_CONVERSATION_DATASET_NAME_MIN_LENGTH = 3

// Maximum length of a record's input and of its expected output, in characters.
export const EVALUATION_CONVERSATION_DATASET_RECORD_MAX_LENGTH = 10_000

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
