import type {
  BaseAgentSessionTypeDto,
  PresignAgentSessionMessageAttachmentDocumentResponseDto,
} from "@caseai-connect/api-contracts"
import type { AgentSessionMcpAppHtml, AgentSessionMessage } from "./agent-session-messages.models"

type BaseParams = {
  organizationId: string
  projectId: string
  agentId: string
  agentSessionId: string
}
export interface IAgentSessionMessagesSpi {
  getAll: (
    params: BaseParams & { payload: { type: BaseAgentSessionTypeDto } },
  ) => Promise<AgentSessionMessage[]>
  getOne: (
    params: BaseParams & { messageId: string } & { payload: { type: BaseAgentSessionTypeDto } },
  ) => Promise<AgentSessionMessage>
  getMcpAppHtml: (
    params: BaseParams & { payload: { type: BaseAgentSessionTypeDto } },
  ) => Promise<AgentSessionMcpAppHtml[]>
  uploadAttachmentDocument: (
    params: BaseParams & { file: File; payload: { type: BaseAgentSessionTypeDto } },
  ) => Promise<
    Pick<PresignAgentSessionMessageAttachmentDocumentResponseDto, "attachmentDocumentId">
  >
  getAttachmentDocumentTemporaryUrl: (
    params: BaseParams & {
      attachmentDocumentId: string
      payload: { type: BaseAgentSessionTypeDto }
    },
  ) => Promise<{ url: string }>
}
