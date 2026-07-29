import type {
  AgentRunSettingsSnapshotDto,
  EvaluationExtractionRunDto,
  EvaluationExtractionRunKeyMappingEntryDto,
  EvaluationExtractionRunRecordDto,
  EvaluationExtractionRunRecordFieldResultDto,
  EvaluationExtractionRunRecordFieldStatusDto,
  EvaluationExtractionRunRecordStatusDto,
  EvaluationExtractionRunStatusDto,
  EvaluationExtractionRunSummaryDto,
} from "@caseai-connect/api-contracts"

export type EvaluationExtractionRun = EvaluationExtractionRunDto
export type EvaluationExtractionRunAgentSettings = AgentRunSettingsSnapshotDto & {
  outputJsonSchema?: Record<string, unknown>
}
export type EvaluationExtractionRunRecord = EvaluationExtractionRunRecordDto
export type EvaluationExtractionRunStatus = EvaluationExtractionRunStatusDto
export type EvaluationExtractionRunRecordStatus = EvaluationExtractionRunRecordStatusDto
export type EvaluationExtractionRunRecordFieldStatus = EvaluationExtractionRunRecordFieldStatusDto
export type EvaluationExtractionRunKeyMappingEntry = EvaluationExtractionRunKeyMappingEntryDto
export type EvaluationExtractionRunSummary = EvaluationExtractionRunSummaryDto
export type EvaluationExtractionRunRecordFieldResult = EvaluationExtractionRunRecordFieldResultDto

export type PaginatedEvaluationExtractionRunRecords = {
  records: EvaluationExtractionRunRecord[]
  total: number
  page: number
  limit: number
}

export type EvaluationExtractionRunStatusChangedEvent = {
  evaluationExtractionRunId: string
  status: EvaluationExtractionRunStatusDto
  summary: EvaluationExtractionRunSummaryDto | null
  updatedAt: number
}
