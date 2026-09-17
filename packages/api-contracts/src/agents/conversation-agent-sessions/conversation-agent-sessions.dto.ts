import type { TimeType } from "../../generic"

export type BaseAgentSessionTypeDto = "playground" | "live"

export type ConversationFormStatusDto = "in_progress" | "concluded"

/**
 * One form of a conversation: the answers the fillForm tool collected for one
 * agent of the conversation (the session's agent, or a sub-agent that ran in
 * it). A conversation keeps every form filled in it.
 */
export type ConversationFormDto = {
  agentId: string
  /** The agent settings revision in force at the last write. */
  agentSettingsId: string
  status: ConversationFormStatusDto
  state: Record<string, unknown>
  /** Written at conclusion: what the agent collected or answered, in a few sentences. */
  summary?: string
  /** The agent's current form schema, to render the state. Absent when the agent has no form. */
  outputJsonSchema?: Record<string, unknown>
  updatedAt: TimeType
}

export type ConversationAgentSessionDto = {
  id: string
  agentId: string
  type: BaseAgentSessionTypeDto
  title?: string
  createdAt: TimeType
  updatedAt: TimeType
  traceUrl?: string
  /** The forms filled in this conversation; empty when no agent has fillForm or nothing was written. */
  forms: ConversationFormDto[]
  /**
   * The sub-agent the user is talking to right now, when a handoff is in progress. Absent when
   * the session's own agent answers.
   */
  activeAgentId?: string
}

/**
 * A sub-session spawned when a parent agent delegates to a fillForm-enabled
 * sub-agent during a session. Carries the child agent's identity and output
 * schema alongside the session and its forms so the parent session view can
 * render the sub-agent's form without extra lookups.
 */
export type ConversationSubSessionDto = {
  toolName: string
  agentId: string
  agentName: string
  outputJsonSchema?: Record<string, unknown>
  session: ConversationAgentSessionDto
}
