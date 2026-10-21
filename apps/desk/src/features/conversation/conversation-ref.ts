/** The path params of one conversation. */
export type ConversationRef = {
  organizationId: string
  projectId: string
  agentId: string
  agentSessionId: string
}

/** The path params of the agent a conversation is held with. */
export type ConversationAgentRef = Omit<ConversationRef, "agentSessionId">
