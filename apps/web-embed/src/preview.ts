import type { AgentSessionMessageDto } from "@bayes-platform/api-contracts"

/**
 * What the launcher may show next to its button while the chat is closed: the opening message of
 * a conversation the visitor has not answered yet, or null once they have written anything.
 */
export function previewOf(
  messages: Pick<AgentSessionMessageDto, "role" | "content">[],
): string | null {
  if (messages.some((m) => m.role === "user")) return null
  const opening = messages.find((m) => m.role === "assistant" && m.content.trim())
  return opening ? opening.content.trim() : null
}

/**
 * The agent's latest finished answer to the visitor, for the launcher to show while the chat is
 * closed: a reply that ends after the visitor folded the chat away gets a badge and a preview.
 * Null until the visitor has written.
 */
export function latestReplyOf(
  messages: Pick<AgentSessionMessageDto, "id" | "role" | "content" | "status">[],
): { id: string; text: string } | null {
  const lastUser = messages.map((m) => m.role).lastIndexOf("user")
  if (lastUser === -1) return null
  const reply = messages
    .slice(lastUser + 1)
    .reverse()
    .find((m) => m.role === "assistant" && m.status === "completed" && m.content.trim())
  return reply ? { id: reply.id, text: reply.content.trim() } : null
}
