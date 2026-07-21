import type {
  AgentLocale,
  AgentModel,
  AgentTemperature,
  DocumentsRagMode,
} from "../agents/agents.dto"
import type { TimeType } from "../generic"

export const EVALUATION_CONVERSATION_RUN_STATUS_CHANGED_CHANNEL_DTO =
  "evaluation_conversation_run_status_changed"

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
export type CreateEvaluationConversationRunRequestDto = {
  agentId: string
  // Agent-settings revision to pin on the run; null pins the latest revision.
  agentSettingsRevision: number | null
  datasetId: string
  // LLM judge model used to grade this run's records.
  judgeModel: AgentModel
}

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
