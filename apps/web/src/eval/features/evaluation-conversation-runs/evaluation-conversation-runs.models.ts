import type {
  EvaluationConversationRunAgentSettingsDto,
  EvaluationConversationRunDto,
  EvaluationConversationRunRecordDto,
  EvaluationConversationRunRecordStatusDto,
  EvaluationConversationRunStatusDto,
  EvaluationConversationRunSummaryDto,
  PaginatedEvaluationConversationRunRecordsDto,
} from "@caseai-connect/api-contracts"

export type EvaluationConversationRun = EvaluationConversationRunDto
export type EvaluationConversationRunAgentSettings = EvaluationConversationRunAgentSettingsDto
export type EvaluationConversationRunRecord = EvaluationConversationRunRecordDto
export type EvaluationConversationRunStatus = EvaluationConversationRunStatusDto
export type EvaluationConversationRunRecordStatus = EvaluationConversationRunRecordStatusDto
export type EvaluationConversationRunSummary = EvaluationConversationRunSummaryDto

export type PaginatedEvaluationConversationRunRecords = PaginatedEvaluationConversationRunRecordsDto

export type EvaluationConversationRunStatusChangedEvent = {
  evaluationConversationRunId: string
  status: EvaluationConversationRunStatusDto
  summary: EvaluationConversationRunSummaryDto | null
  updatedAt: number
}
