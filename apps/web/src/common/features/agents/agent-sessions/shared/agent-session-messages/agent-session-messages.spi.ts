import type { PresignAgentSessionMessageAttachmentDocumentResponseDto } from "@caseai-connect/api-contracts"
import type { AgentSessionMcpAppHtml, AgentSessionMessage } from "./agent-session-messages.models"

type BaseParams = {
  organizationId: string
  projectId: string
  agentId: string
  agentSessionId: string
}
export interface IAgentSessionMessagesSpi {
  getAll: (params: BaseParams) => Promise<AgentSessionMessage[]>
  getOne: (params: BaseParams & { messageId: string }) => Promise<AgentSessionMessage>
  getMcpAppHtml: (params: BaseParams) => Promise<AgentSessionMcpAppHtml[]>
  uploadAttachmentDocument: (
    params: BaseParams & { file: File },
  ) => Promise<
    Pick<PresignAgentSessionMessageAttachmentDocumentResponseDto, "attachmentDocumentId">
  >
  getAttachmentDocumentTemporaryUrl: (
    params: BaseParams & { attachmentDocumentId: string },
  ) => Promise<{ url: string }>
}
