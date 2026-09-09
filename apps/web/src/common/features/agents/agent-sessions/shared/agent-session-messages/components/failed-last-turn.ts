import type { AgentSessionMessage } from "../agent-session-messages.models"

export type FailedLastTurn = {
  /** The user message to send again. */
  userMessage: AgentSessionMessage
  /** Index of the failed reply, where the Retry affordance is rendered. */
  replyIndex: number
}

/**
 * The last turn of the thread when its reply failed or was interrupted. Tool rows persisted
 * while the reply was written sort after it, so they are skipped. Older failures stay as they
 * are: resending them would append out of order.
 */
export function findFailedLastTurn(messages: AgentSessionMessage[]): FailedLastTurn | undefined {
  let replyIndex = messages.length - 1
  while (messages[replyIndex]?.role === "tool") replyIndex -= 1
  const reply = messages[replyIndex]
  if (reply?.role !== "assistant") return undefined
  if (reply.status !== "aborted" && reply.status !== "error") return undefined
  for (let index = replyIndex - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role === "user") return { userMessage: message, replyIndex }
  }
  return undefined
}
