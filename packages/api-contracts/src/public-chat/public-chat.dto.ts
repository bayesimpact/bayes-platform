import type { AgentSessionToolCallDto } from "../agents/shared/agent-session-messages/agent-session-messages.dto"
import type { TimeType } from "../generic"

export type PublicSessionMessageDto = {
  id: string
  role: "user" | "assistant" | "tool"
  content: string
  status?: "streaming" | "completed" | "aborted" | "error"
  createdAt: TimeType
  /**
   * Present when the turn ran tools. MCP Apps carry their `ui://` card pointer; the card HTML
   * is served by `getMcpAppHtml`.
   */
  toolCalls?: AgentSessionToolCallDto[]
}

export type PublicAgentSessionDto = {
  id: string
  agentId: string
  messages: PublicSessionMessageDto[]
  createdAt: TimeType
}

export type CreatePublicSessionRequestDto = {
  externalVisitorId?: string
}

export type CreatePublicSessionResponseDto = {
  sessionId: string
  sessionToken: string
}
