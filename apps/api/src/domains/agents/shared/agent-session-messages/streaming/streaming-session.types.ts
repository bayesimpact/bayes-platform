import type { ConversationAgentSession } from "../../../conversation-agent-sessions/conversation-agent-session.entity"
import type { FormAgentSession } from "../../../form-agent-sessions/form-agent-session.entity"
import type { AgentMessage } from "../agent-message.entity"

/**
 * Minimal session context for public/anonymous sessions that have no
 * corresponding ConversationAgentSession or FormAgentSession row.
 */
export type PublicStreamingSessionProxy = {
  id: string
  traceId: string
  organizationId: string
  messages: AgentMessage[]
}

export type StreamingSession =
  | ConversationAgentSession
  | FormAgentSession
  | PublicStreamingSessionProxy
