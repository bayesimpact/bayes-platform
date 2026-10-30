import type { ConversationParamsDto } from "@caseai-connect/desk-contracts"
import { useConversationTitle } from "../hooks/use-conversation-title"

export type ConversationTitleProps = {
  conversation: ConversationParamsDto
}

/** The open conversation's name, which the bar above it shows in place of the agent's. */
export function ConversationTitle({ conversation }: ConversationTitleProps) {
  return useConversationTitle(conversation)
}
