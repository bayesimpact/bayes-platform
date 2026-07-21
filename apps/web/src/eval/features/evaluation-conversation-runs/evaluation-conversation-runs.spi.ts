import type { AgentModel } from "@caseai-connect/api-contracts"
import type {
  EvaluationConversationRun,
  EvaluationConversationRunStatusChangedEvent,
  PaginatedEvaluationConversationRunRecords,
} from "./evaluation-conversation-runs.models"

type BaseParams = { organizationId: string; projectId: string }

export interface IEvaluationConversationRunsSpi {
  createOne(
    params: BaseParams & {
      payload: {
        agentId: string
        // Agent-settings revision to pin on the run; null pins the latest revision.
        agentSettingsRevision: number | null
        datasetId: string
        judgeModel: AgentModel
      }
    },
  ): Promise<EvaluationConversationRun>
  executeOne(
    params: BaseParams & { evaluationConversationRunId: string; recordLimit: number | null },
  ): Promise<EvaluationConversationRun>
  retryOne(
    params: BaseParams & { evaluationConversationRunId: string },
  ): Promise<EvaluationConversationRun>
  cancelOne(
    params: BaseParams & { evaluationConversationRunId: string },
  ): Promise<EvaluationConversationRun>
  getOne(
    params: BaseParams & { evaluationConversationRunId: string },
  ): Promise<EvaluationConversationRun>
  getAll(params: BaseParams): Promise<EvaluationConversationRun[]>
  getRecords(
    params: BaseParams & {
      evaluationConversationRunId: string
      page?: number
      limit?: number
    },
  ): Promise<PaginatedEvaluationConversationRunRecords>
  streamRunStatus(params: {
    organizationId: string
    projectId: string
    signal?: AbortSignal
    onStatusChanged: (event: EvaluationConversationRunStatusChangedEvent) => void
  }): Promise<void>
  deleteOne(params: BaseParams & { evaluationConversationRunId: string }): Promise<void>
}
