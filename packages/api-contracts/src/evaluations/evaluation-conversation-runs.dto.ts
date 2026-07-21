import { z } from "zod"
import {
  type AgentLocale,
  AgentModel,
  type AgentTemperature,
  type DocumentsRagMode,
} from "../agents/agents.dto"
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

// Snapshot of the agent-settings revision pinned on a run at creation time.
export type EvaluationConversationRunAgentSettingsDto = {
  documentsRagMode: DocumentsRagMode
  instructions: string
  locale: AgentLocale
  model: AgentModel
  revision: number
  temperature: AgentTemperature
}

// DTOs
export type EvaluationConversationRunDto = {
  id: string
  evaluationConversationDatasetId: string
  agentId: string
  agentSettings: EvaluationConversationRunAgentSettingsDto
  status: EvaluationConversationRunStatusDto
  // LLM judge model used to grade this run's records.
  judgeModel: AgentModel
  // Optional extra instructions injected into the judge's grading prompt.
  judgeInstructions: string | null
  summary: EvaluationConversationRunSummaryDto | null
  projectId: string
  createdAt: TimeType
  updatedAt: TimeType
}

export type EvaluationConversationRunRecordDto = {
  id: string
  evaluationConversationRunId: string
  // Null when the source dataset record has been deleted; the run record keeps
  // its own input/expectedOutput snapshot.
  evaluationConversationDatasetRecordId: string | null
  status: EvaluationConversationRunRecordStatusDto
  input: string
  expectedOutput: string
  output: string | null
  score: number | null
  errorDetails: string | null
  traceUrl: string | null
  createdAt: TimeType
  updatedAt: TimeType
}

// Request DTOs
export const createEvaluationConversationRunSchema = z.object({
  agentId: z.string(),
  // Agent-settings revision to pin on the run; null pins the latest revision.
  agentSettingsRevision: z.number().int().nullable(),
  datasetId: z.string(),
  // LLM judge model used to grade this run's records.
  judgeModel: z.nativeEnum(AgentModel),
  // Optional extra instructions injected into the judge's grading prompt.
  judgeInstructions: z
    .string()
    .trim()
    .max(EVALUATION_CONVERSATION_RUN_JUDGE_INSTRUCTIONS_MAX_LENGTH)
    .nullable(),
})

export type CreateEvaluationConversationRunRequestDto = z.infer<
  typeof createEvaluationConversationRunSchema
>

export type ExecuteEvaluationConversationRunRequestDto = {
  recordLimit: number | null
}

// Paginated response
export type PaginatedEvaluationConversationRunRecordsDto = {
  records: EvaluationConversationRunRecordDto[]
  total: number
  page: number
  limit: number
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
