/** The replies this tab is streaming, by conversation, so leaving one can stop its stream. */
const replyStreams = new Map<string, AbortController>()

/** Registers the stream of a new reply, and stops the previous one of that conversation. */
export function registerReplyStream(agentSessionId: string): AbortController {
  replyStreams.get(agentSessionId)?.abort()
  const controller = new AbortController()
  replyStreams.set(agentSessionId, controller)
  return controller
}

export function unregisterReplyStream(agentSessionId: string, controller: AbortController): void {
  if (replyStreams.get(agentSessionId) === controller) replyStreams.delete(agentSessionId)
}

/** Whether this tab streams a reply of the conversation right now. */
export function isReplyStreaming(agentSessionId: string): boolean {
  return replyStreams.has(agentSessionId)
}

/**
 * Stops reading the reply of a conversation the person leaves. The server keeps writing it, and
 * the conversation picks it up when the person comes back.
 */
export function stopReplyStream(agentSessionId: string): void {
  replyStreams.get(agentSessionId)?.abort()
}
