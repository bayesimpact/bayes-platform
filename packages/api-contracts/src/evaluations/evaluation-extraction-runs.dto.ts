import type { TimeType } from "../generic"

export const EVALUATION_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL_DTO =
  "evaluation_extraction_run_status_changed"

// Types
export type EvaluationExtractionRunStatusDto =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
export type EvaluationExtractionRunSummaryDto = {
  total: number
  perfectMatches: number
  mismatches: number
  errors: number
  running: number
}

// SSE Event DTOs
export type EvaluationExtractionRunStatusChangedEventPayload = {
  type: typeof EVALUATION_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL_DTO
  evaluationExtractionRunId: string
  organizationId: string
  projectId: string
  status: EvaluationExtractionRunStatusDto
  summary: EvaluationExtractionRunSummaryDto | null
  updatedAt: TimeType
}

export type EvaluationExtractionRunStatusChangedEventDto = MessageEvent &
  EvaluationExtractionRunStatusChangedEventPayload
