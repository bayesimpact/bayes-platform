import type { BaseAgentSessionTypeDto } from "../../agents/conversation-agent-sessions/conversation-agent-sessions.dto"
import type { TimeType } from "../../generic"

export type FormAgentSessionDto = {
  agentId: string
  createdAt: TimeType
  id: string
  result?: Record<string, unknown>
  traceUrl?: string
  type: BaseAgentSessionTypeDto
  updatedAt: TimeType
}

/**
 * A form sub-session spawned when a parent (conversation) agent delegates to a
 * form sub-agent during a session. Carries the child form agent's identity and
 * output schema alongside the accumulated session result so the parent session
 * view can render the sub-agent's form result without extra lookups.
 */
export type FormSubSessionDto = {
  toolName: string
  agentId: string
  agentName: string
  outputJsonSchema?: Record<string, unknown>
  session: FormAgentSessionDto
}
