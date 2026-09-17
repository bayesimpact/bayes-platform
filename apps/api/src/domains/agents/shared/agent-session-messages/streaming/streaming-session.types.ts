import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentSettings } from "@/domains/agents/settings/agent-settings.entity"
import type { ConversationAgentSession } from "../../../conversation-agent-sessions/conversation-agent-session.entity"
import type { AgentMessage } from "../agent-message.entity"
import type { ToolExecutionLog } from "./tools/tool-execution-log"

/**
 * Minimal session context for public/anonymous sessions that have no
 * corresponding ConversationAgentSession row.
 */
export type PublicStreamingSessionProxy = {
  /**
   * Whether the session has a row the forms can attach to. True for public
   * (embed) sessions, false for evaluation runs, which have no session and
   * therefore no fillForm tool.
   */
  persistsForms: boolean
  id: string
  traceId: string
  organizationId: string
  /**
   * Identifier the embedding page attached to this session (for France
   * Travail: the "identifiant DE"). Forwarded to MCP servers as context.
   */
  externalVisitorId?: string | null
  messages: AgentMessage[]
}

export type StreamingSession = ConversationAgentSession | PublicStreamingSessionProxy

/** Whether the fillForm tool can store a form for this session (see {@link PublicStreamingSessionProxy.persistsForms}). */
export function sessionPersistsForms(session: StreamingSession): boolean {
  return "persistsForms" in session ? session.persistsForms : true
}

export type AgentSessionScope = {
  agent: Agent
  agentSettings: AgentSettings
  session: StreamingSession
  connectScope: RequiredConnectScope
}

/**
 * Tool-execution log callback. May persist the tool call and notify the SSE
 * client — tools MUST await it so persistence and notify events complete
 * before the step (and therefore the stream) ends.
 */
export type OnExecute = (toolExecution: ToolExecutionLog) => void | Promise<void>
