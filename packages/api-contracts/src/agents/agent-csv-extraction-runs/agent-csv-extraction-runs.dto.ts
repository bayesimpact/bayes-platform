import type { TimeType } from "../../generic"

export const AGENT_CSV_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL_DTO =
  "agent_csv_extraction_run_status_changed"

export const AGENT_CSV_EXTRACTION_RUN_COLUMN_ROLES = ["input", "reference", "ignore"] as const
export type AgentCsvExtractionRunColumnRoleDto =
  (typeof AGENT_CSV_EXTRACTION_RUN_COLUMN_ROLES)[number]

// Run types
export type AgentCsvExtractionRunStatusDto =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export type AgentCsvExtractionRunRecordStatusDto = "running" | "success" | "error" | "cancelled"

export type AgentCsvExtractionRunSummaryDto = {
  total: number
  processed: number
  errors: number
  running: number
}

export type AgentCsvExtractionRunColumnSchemaEntryDto = {
  id: string
  originalName: string
  finalName: string
  role: AgentCsvExtractionRunColumnRoleDto
  index: number
}

export type AgentCsvExtractionRunColumnSchemaDto = Record<
  string,
  AgentCsvExtractionRunColumnSchemaEntryDto
>

// DTOs
export type AgentCsvExtractionRunDto = {
  id: string
  agentId: string
  csvDocumentId: string
  columnSchema: AgentCsvExtractionRunColumnSchemaDto
  status: AgentCsvExtractionRunStatusDto
  summary: AgentCsvExtractionRunSummaryDto | null
  csvExportDocumentId: string | null
  projectId: string
  createdAt: TimeType
  updatedAt: TimeType
}

export type AgentCsvExtractionRunRecordDto = {
  id: string
  agentCsvExtractionRunId: string
  rowIndex: number
  status: AgentCsvExtractionRunRecordStatusDto
  inputData: Record<string, unknown> | null
  agentRawOutput: Record<string, unknown> | null
  errorDetails: string | null
  traceUrl: string | null
  createdAt: TimeType
  updatedAt: TimeType
}

// Request DTOs
export type CreateAgentCsvExtractionRunRequestDto = {
  csvDocumentId: string
  columnSchema: AgentCsvExtractionRunColumnSchemaDto
}

export type ExecuteAgentCsvExtractionRunRequestDto = {
  recordLimit: number | null
}

// Paginated response
export type PaginatedAgentCsvExtractionRunRecordsDto = {
  records: AgentCsvExtractionRunRecordDto[]
  total: number
  page: number
  limit: number
}

// SSE event DTOs
export type AgentCsvExtractionRunStatusChangedEventPayload = {
  type: typeof AGENT_CSV_EXTRACTION_RUN_STATUS_CHANGED_CHANNEL_DTO
  agentCsvExtractionRunId: string
  organizationId: string
  projectId: string
  agentId: string
  status: AgentCsvExtractionRunStatusDto
  summary: AgentCsvExtractionRunSummaryDto | null
  updatedAt: TimeType
}

export type AgentCsvExtractionRunStatusChangedEventDto = MessageEvent &
  AgentCsvExtractionRunStatusChangedEventPayload
