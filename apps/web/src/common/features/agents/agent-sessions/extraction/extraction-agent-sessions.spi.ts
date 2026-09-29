import type { BaseAgentSessionTypeDto, SuccessResponseDTO } from "@caseai-connect/api-contracts"
import type { Document } from "@/studio/features/documents/documents.models"
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
      agentSettingsRevision?: number
    },
  ) => Promise<ExtractionAgentSessionResult>
  deleteOne: (params: BaseParams & { agentSessionId: string }) => Promise<SuccessResponseDTO>
  /** Presigns, sends the bytes to storage and confirms: the document a run can then read. */
  uploadDocument: (params: BaseParams & { file: File }) => Promise<Document>
  listMyDocuments: (params: BaseParams) => Promise<Document[]>
  streamSessionStatus: (params: {
    organizationId: string
    projectId: string
    agentId: string
    signal?: AbortSignal
    onStatusChanged: (event: ExtractionAgentSessionStatusChangedEvent) => void
  }) => Promise<void>
}
