/** The replies a chat streams, by conversation, so leaving one can stop its stream. */
export type ReplyStreams = {
  /** Registers the stream of a new reply, and stops the previous one of that conversation. */
  register: (agentSessionId: string) => AbortController
  unregister: (agentSessionId: string, controller: AbortController) => void
  /** Whether this tab streams a reply of the conversation right now. */
  isStreaming: (agentSessionId: string) => boolean
  /**
   * Stops reading the reply of a conversation the person leaves. The server keeps writing it, and
   * the conversation picks it up when the person comes back.
   */
  stop: (agentSessionId: string) => void
}

export function createReplyStreams(): ReplyStreams {
  const streams = new Map<string, AbortController>()
  return {
    register(agentSessionId) {
      streams.get(agentSessionId)?.abort()
      const controller = new AbortController()
      streams.set(agentSessionId, controller)
      return controller
    },
    unregister(agentSessionId, controller) {
      if (streams.get(agentSessionId) === controller) streams.delete(agentSessionId)
    },
    isStreaming: (agentSessionId) => streams.has(agentSessionId),
    stop(agentSessionId) {
      streams.get(agentSessionId)?.abort()
    },
  }
}
