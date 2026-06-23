import type {
  ExtractionAgentSessionDto,
  ExtractionAgentSessionResultDto,
  ExtractionAgentSessionStatus,
  ExtractionAgentSessionSummaryDto,
} from "@caseai-connect/api-contracts"
import type { AgentCsvExtractionRun } from "../../csv-extraction-runs/agent-csv-extraction-runs.models"

export type ExtractionAgentSession = ExtractionAgentSessionDto
export type ExtractionAgentSessionSummary = ExtractionAgentSessionSummaryDto
export type ExtractionAgentSessionResult = ExtractionAgentSessionResultDto

export type ExtractionAgentSessionStatusChangedEvent = {
  extractionAgentSessionId: string
  agentId: string
  status: ExtractionAgentSessionStatus
  updatedAt: number
}

export type ExtractionAgentSessions = {
  csvSessions: AgentCsvExtractionRun[]
  others: ExtractionAgentSessionSummary[]
}
