import type { SuccessResponseDTO } from "@caseai-connect/api-contracts"
import type {
  ConversationAgentSession,
  ConversationSubSession,
} from "./conversation-agent-sessions.models"

type BaseParams = {
  organizationId: string
  projectId: string
  agentId: string
}
export interface IConversationAgentSessionsSpi {
  getAll: (params: BaseParams) => Promise<ConversationAgentSession[]>
  /**
   * `variables` carries the values for the revision's declared {{variables}}; a declared
   * variable without a value falls back to the revision's defaults.
   */
  createOne: (
    params: BaseParams & { agentSettingsRevision?: number; variables?: Record<string, string> },
  ) => Promise<ConversationAgentSession>
  deleteOne: (params: BaseParams & { agentSessionId: string }) => Promise<SuccessResponseDTO>
  listSubSessions: (
    params: BaseParams & { agentSessionId: string },
  ) => Promise<ConversationSubSession[]>
}
