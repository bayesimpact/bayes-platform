import {
  type ConversationMessageOutputDto,
  conversationMessageOutputSchema,
  toolCallOutputSchema,
} from "@bayes-platform/eval-contracts"
import type { z } from "zod"

type ToolCallOutputDto = z.output<typeof toolCallOutputSchema>

/** A tool an agent called while it answered, checked against the contract. */
export function buildToolCall(overrides: Partial<ToolCallOutputDto> = {}): ToolCallOutputDto {
  return toolCallOutputSchema.parse({
    id: crypto.randomUUID(),
    name: "lookup_knowledge_base",
    arguments: {},
    ...overrides,
  })
}

/** A message of a conversation, checked against the contract. */
export function buildConversationMessage(
  overrides: Partial<ConversationMessageOutputDto> = {},
): ConversationMessageOutputDto {
  return conversationMessageOutputSchema.parse({
    id: crypto.randomUUID(),
    role: "assistant",
    content: "Hello! Ask me anything about our plans and prices.",
    status: "completed",
    createdAt: Date.now(),
    ...overrides,
  })
}
