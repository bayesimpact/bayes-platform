import type { AgentCsvExtractionRunColumnSchemaDto } from "@caseai-connect/api-contracts"
import type {
  AgentCsvExtractionRun,
  AgentCsvExtractionRunStatusChangedEvent,
  PaginatedAgentCsvExtractionRunRecords,
} from "./agent-csv-extraction-runs.models"

type BaseParams = { organizationId: string; projectId: string; agentId: string }

export interface IAgentCsvExtractionRunsSpi {
  createOne(
    params: BaseParams & {
      payload: {
        csvDocumentId: string
        columnSchema: AgentCsvExtractionRunColumnSchemaDto
      }
    },
  ): Promise<AgentCsvExtractionRun>
  executeOne(
    params: BaseParams & { agentCsvExtractionRunId: string; recordLimit: number | null },
  ): Promise<AgentCsvExtractionRun>
  retryOne(params: BaseParams & { agentCsvExtractionRunId: string }): Promise<AgentCsvExtractionRun>
  cancelOne(
    params: BaseParams & { agentCsvExtractionRunId: string },
  ): Promise<AgentCsvExtractionRun>
  getOne(params: BaseParams & { agentCsvExtractionRunId: string }): Promise<AgentCsvExtractionRun>
  getAll(params: BaseParams): Promise<AgentCsvExtractionRun[]>
  getFileColumns(
    params: BaseParams & { documentId: string },
  ): Promise<{ id: string; name: string; values: unknown[] }[]>
  getRecords(
    params: BaseParams & {
      agentCsvExtractionRunId: string
      page?: number
      limit?: number
      columnFilters?: Record<string, string>
      sortBy?: string
      sortOrder?: "asc" | "desc"
    },
  ): Promise<PaginatedAgentCsvExtractionRunRecords>
  streamRunStatus(params: {
    organizationId: string
    projectId: string
    agentId: string
    signal?: AbortSignal
    onStatusChanged: (event: AgentCsvExtractionRunStatusChangedEvent) => void
  }): Promise<void>
  deleteOne(params: BaseParams & { agentCsvExtractionRunId: string }): Promise<void>
}
