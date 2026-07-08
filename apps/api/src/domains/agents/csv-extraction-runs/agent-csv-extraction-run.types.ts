import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { AgentWithSettingsRunJobPayload } from "@/domains/agents/shared/agent-with-settings-run.types"
import type {
  AgentCsvExtractionRun,
  AgentCsvExtractionRunColumnSchema,
} from "./agent-csv-extraction-run.entity"

export type ExecuteAgentCsvExtractionRunJobPayload = {
  agentCsvExtractionRunId: string
  organizationId: string
  projectId: string
  recordLimit: number | null
}

export type ProcessAgentCsvExtractionRunRecordJobPayload = {
  agentCsvExtractionRun: AgentCsvExtractionRun
  runRecordId: string
  connectScope: RequiredConnectScope
  columnSchema: AgentCsvExtractionRunColumnSchema
  agentWithSettings: AgentWithSettingsRunJobPayload
}
