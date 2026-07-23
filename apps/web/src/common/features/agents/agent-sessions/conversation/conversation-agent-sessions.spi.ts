import type { BaseAgentSessionTypeDto, SuccessResponseDTO } from "@caseai-connect/api-contracts"
import type {
  ConversationAgentSession,
  ConversationSubSession,
} from "./conversation-agent-sessions.models"

type BaseParams = {
  organizationId: string
  projectId: string
  agentId: string
  type: BaseAgentSessionTypeDto
}
export interface IConversationAgentSessionsSpi {
  getAll: (params: BaseParams) => Promise<ConversationAgentSession[]>
  createOne: (params: BaseParams) => Promise<ConversationAgentSession>
  deleteOne: (params: BaseParams & { agentSessionId: string }) => Promise<SuccessResponseDTO>
  listSubSessions: (
    params: BaseParams & { agentSessionId: string },
  ) => Promise<ConversationSubSession[]>
}
