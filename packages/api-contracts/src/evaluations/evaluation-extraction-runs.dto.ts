import { z } from "zod"
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
export type EvaluationExtractionRunRecordStatusDto =
  | "match"
  | "mismatch"
  | "error"
  | "running"
  | "cancelled"
export type EvaluationExtractionRunRecordFieldStatusDto = "match" | "mismatch" | "fyi"

export type EvaluationExtractionRunKeyMappingEntryDto = {
  agentOutputKey: string
  datasetColumnId: string
  mode: "scored" | "fyi"
}

export type EvaluationExtractionRunSummaryDto = {
  total: number
  perfectMatches: number
  mismatches: number
  errors: number
  running: number
}

export type EvaluationExtractionRunRecordFieldResultDto = {
  agentValue: unknown
  groundTruth: unknown
  status: EvaluationExtractionRunRecordFieldStatusDto
}

// DTOs
export type EvaluationExtractionRunDto = {
  id: string
  evaluationExtractionDatasetId: string
  agentId: string
  agentSettingsId: string
  // Revision of the settings version the run is pinned to.
  agentRevision: number
  keyMapping: EvaluationExtractionRunKeyMappingEntryDto[]
  status: EvaluationExtractionRunStatusDto
  summary: EvaluationExtractionRunSummaryDto | null
  csvExportDocumentId: string | null
  projectId: string
  createdAt: TimeType
  updatedAt: TimeType
}

export type EvaluationExtractionRunRecordDto = {
  id: string
  evaluationExtractionRunId: string
  evaluationExtractionDatasetRecordId: string
  status: EvaluationExtractionRunRecordStatusDto
  comparison: Record<string, EvaluationExtractionRunRecordFieldResultDto> | null
  agentRawOutput: Record<string, unknown> | null
  errorDetails: string | null
  datasetRecordData: Record<string, unknown> | null
  traceUrl: string | null
  createdAt: TimeType
  updatedAt: TimeType
}

// Request DTOs
export const createEvaluationExtractionRunSchema = z.object({
  evaluationExtractionDatasetId: z.string(),
  agentId: z.string(),
  // Saved agent-settings revision to pin on the run; null pins the revision in production.
  agentSettingsRevision: z.number().int().nullable(),
  keyMapping: z.array(
    z.object({
      agentOutputKey: z.string(),
      datasetColumnId: z.string(),
      mode: z.enum(["scored", "fyi"]),
    }),
  ),
})

export type CreateEvaluationExtractionRunRequestDto = z.infer<
  typeof createEvaluationExtractionRunSchema
>

export type ExecuteEvaluationExtractionRunRequestDto = {
  recordLimit: number | null
}

// Paginated response
export type PaginatedEvaluationExtractionRunRecordsDto = {
  records: EvaluationExtractionRunRecordDto[]
  total: number
  page: number
  limit: number
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
