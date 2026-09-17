import type { SessionMetadataRecalculator } from "./turn-classification"

/**
 * Where the session metadata (title, categories) is persisted. Conversation
 * sessions default to ConversationAgentSessionsService; PUBLIC (embed)
 * sessions pass their own target (PublicAgentSessionsService), keyed on
 * public_agent_session. Provided by the caller (public-chat domain) to avoid
 * a domain cycle: agents must not import public-chat services. Forms need no
 * target: they live in conversation_form for both kinds of session.
 */
export type SessionStateTarget = {
  metadataRecalculator: SessionMetadataRecalculator
}
