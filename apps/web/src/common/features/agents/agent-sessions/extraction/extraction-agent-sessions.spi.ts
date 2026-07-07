import type { BaseAgentSessionTypeDto, SuccessResponseDTO } from "@caseai-connect/api-contracts"
import type {
  ExtractionAgentSession,
  ExtractionAgentSessionResult,
  ExtractionAgentSessionStatusChangedEvent,
  ExtractionAgentSessionSummary,
} from "./extraction-agent-sessions.models"

type BaseParams = {
  organizationId: string
  projectId: string
  agentId: string
  type: BaseAgentSessionTypeDto
}
export interface IExtractionAgentSessionsSpi {
  getAll: (params: BaseParams) => Promise<ExtractionAgentSessionSummary[]>
  getOne: (
    params: BaseParams & {
      agentSessionId: string
    },
  ) => Promise<ExtractionAgentSession>
  executeOne: (
    params: BaseParams & {
      documentId: string
    },
  ) => Promise<ExtractionAgentSessionResult>
  deleteOne: (params: BaseParams & { agentSessionId: string }) => Promise<SuccessResponseDTO>
  streamSessionStatus: (params: {
    organizationId: string
    projectId: string
    agentId: string
    signal?: AbortSignal
    onStatusChanged: (event: ExtractionAgentSessionStatusChangedEvent) => void
  }) => Promise<void>
}
