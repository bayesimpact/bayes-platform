import type { AgentSessionMessage } from "../agent-session-messages.models"

/**
 * Revision to mark above each message, by message id. An assistant turn is marked only when its
 * revision differs from the previous assistant turn's, so a conversation that ran entirely on one
 * revision carries a single marker and a mid-session settings change is obvious.
 */
export function buildRevisionMarkers(
  messages: AgentSessionMessage[],
): Map<string, NonNullable<AgentSessionMessage["agentSettings"]>> {
  const markers = new Map<string, NonNullable<AgentSessionMessage["agentSettings"]>>()
  let lastRevision: number | undefined

  for (const message of messages) {
    if (message.role !== "assistant") continue
    const settings = message.agentSettings
    if (!settings) continue
    if (settings.revision !== lastRevision) markers.set(message.id, settings)
    lastRevision = settings.revision
  }

  return markers
}
