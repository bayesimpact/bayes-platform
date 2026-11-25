import type { TimeType } from "../generic"

export const EVALUATION_CONVERSATION_RUN_STATUS_CHANGED_CHANNEL_DTO =
  "evaluation_conversation_run_status_changed"

// Max length accepted for the optional judge instructions on run creation.
export const EVALUATION_CONVERSATION_RUN_JUDGE_INSTRUCTIONS_MAX_LENGTH = 4000

// Types
export type EvaluationConversationRunStatusDto =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
export type EvaluationConversationRunRecordStatusDto = "graded" | "error" | "running" | "cancelled"

export type EvaluationConversationRunSummaryDto = {
  averageScore: number | null
  errors: number
  graded: number
  running: number
  total: number
}

// SSE Event DTOs
export type EvaluationConversationRunStatusChangedEventPayload = {
  type: typeof EVALUATION_CONVERSATION_RUN_STATUS_CHANGED_CHANNEL_DTO
  evaluationConversationRunId: string
  organizationId: string
  projectId: string
  status: EvaluationConversationRunStatusDto
  summary: EvaluationConversationRunSummaryDto | null
  updatedAt: TimeType
}

export type EvaluationConversationRunStatusChangedEventDto = MessageEvent &
  EvaluationConversationRunStatusChangedEventPayload
