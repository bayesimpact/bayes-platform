import type { EvaluationExtractionRunKeyMappingEntryDto } from "@caseai-connect/api-contracts"
import type {
  EvaluationExtractionRun,
  EvaluationExtractionRunStatusChangedEvent,
  PaginatedEvaluationExtractionRunRecords,
} from "./evaluation-extraction-runs.models"

type BaseParams = { organizationId: string; projectId: string }

export interface IEvaluationExtractionRunsSpi {
  createOne(
    params: BaseParams & {
      payload: {
        evaluationExtractionDatasetId: string
        agentId: string
        keyMapping: EvaluationExtractionRunKeyMappingEntryDto[]
      }
    },
  ): Promise<EvaluationExtractionRun>
  executeOne(
    params: BaseParams & { evaluationExtractionRunId: string; recordLimit: number | null },
  ): Promise<EvaluationExtractionRun>
  retryOne(
    params: BaseParams & { evaluationExtractionRunId: string },
  ): Promise<EvaluationExtractionRun>
  cancelOne(
    params: BaseParams & { evaluationExtractionRunId: string },
  ): Promise<EvaluationExtractionRun>
  getOne(
    params: BaseParams & { evaluationExtractionRunId: string },
  ): Promise<EvaluationExtractionRun>
  getAll(params: BaseParams): Promise<EvaluationExtractionRun[]>
  getRecords(
    params: BaseParams & {
      evaluationExtractionRunId: string
      page?: number
      limit?: number
      columnFilters?: Record<string, string>
      sortBy?: string
      sortOrder?: "asc" | "desc"
    },
  ): Promise<PaginatedEvaluationExtractionRunRecords>
  streamRunStatus(params: {
    organizationId: string
    projectId: string
    signal?: AbortSignal
    onStatusChanged: (event: EvaluationExtractionRunStatusChangedEvent) => void
  }): Promise<void>
}
