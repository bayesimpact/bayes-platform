import type { AgentSessionMessageDto } from "@caseai-connect/api-contracts"

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
