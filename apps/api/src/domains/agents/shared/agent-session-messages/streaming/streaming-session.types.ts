import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { Agent } from "@/domains/agents/agent.entity"
import type { ConversationAgentSession } from "../../../conversation-agent-sessions/conversation-agent-session.entity"
import type { FormAgentSession } from "../../../form-agent-sessions/form-agent-session.entity"
import type { AgentMessage } from "../agent-message.entity"
import type { ToolExecutionLog } from "./tools/tool-execution-log"

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

export type AgentSessionScope = {
  agent: Agent
  session: StreamingSession
  connectScope: RequiredConnectScope
}

export type OnExecute = (toolExecution: ToolExecutionLog) => void
