import type {
  AgentCsvExtractionRunDto,
  AgentCsvExtractionRunRecordDto,
  AgentCsvExtractionRunRecordStatusDto,
  AgentCsvExtractionRunStatusDto,
  AgentCsvExtractionRunSummaryDto,
} from "@caseai-connect/api-contracts"

export type AgentCsvExtractionRun = AgentCsvExtractionRunDto
export type AgentCsvExtractionRunRecord = AgentCsvExtractionRunRecordDto
export type AgentCsvExtractionRunStatus = AgentCsvExtractionRunStatusDto
export type AgentCsvExtractionRunRecordStatus = AgentCsvExtractionRunRecordStatusDto
export type AgentCsvExtractionRunSummary = AgentCsvExtractionRunSummaryDto

export type PaginatedAgentCsvExtractionRunRecords = {
  records: AgentCsvExtractionRunRecord[]
  total: number
  page: number
  limit: number
}

export type AgentCsvExtractionRunStatusChangedEvent = {
  agentCsvExtractionRunId: string
  status: AgentCsvExtractionRunStatusDto
  summary: AgentCsvExtractionRunSummaryDto | null
  updatedAt: number
}
