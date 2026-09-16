import type { SessionResultUpdater } from "./fill-form.tool"
import type { SessionMetadataRecalculator } from "./turn-classification"

/**
 * Where the stateful tools persist their session state. Conversation
 * sessions default to ConversationAgentSessionsService; PUBLIC (embed)
 * sessions pass their own target (PublicAgentSessionsService) — same
 * semantics, keyed on public_agent_session. Provided by the caller
 * (public-chat domain) to avoid a domain cycle: agents must not import
 * public-chat services.
 */
export type SessionStateTarget = {
  metadataRecalculator: SessionMetadataRecalculator
  resultUpdater: SessionResultUpdater
}
