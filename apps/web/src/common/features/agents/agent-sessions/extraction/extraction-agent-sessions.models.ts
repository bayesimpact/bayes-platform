import type {
  ExtractionAgentSessionDto,
  ExtractionAgentSessionResultDto,
  ExtractionAgentSessionSummaryDto,
} from "@caseai-connect/api-contracts"
import type { AgentCsvExtractionRun } from "../../csv-extraction-runs/agent-csv-extraction-runs.models"

export type ExtractionAgentSession = ExtractionAgentSessionDto
export type ExtractionAgentSessionSummary = ExtractionAgentSessionSummaryDto
export type ExtractionAgentSessionResult = ExtractionAgentSessionResultDto

export type ExtractionAgentSessions = {
  csvSessions: AgentCsvExtractionRun[]
  others: ExtractionAgentSessionSummary[]
}
