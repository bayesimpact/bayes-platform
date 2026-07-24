import type { TimeType } from "../../generic"

export type BaseAgentSessionTypeDto = "playground" | "live"

export type ConversationAgentSessionDto = {
  id: string
  agentId: string
  type: BaseAgentSessionTypeDto
  title?: string
  createdAt: TimeType
  updatedAt: TimeType
  traceUrl?: string
  // Form state accumulated by the fillForm tool, when the agent has it enabled.
  result?: Record<string, unknown>
}

/**
 * A sub-session spawned when a parent agent delegates to a fillForm-enabled
 * sub-agent during a session. Carries the child agent's identity and output
 * schema alongside the accumulated session result so the parent session view
 * can render the sub-agent's form result without extra lookups.
 */
export type ConversationSubSessionDto = {
  toolName: string
  agentId: string
  agentName: string
  outputJsonSchema?: Record<string, unknown>
  session: ConversationAgentSessionDto
}
