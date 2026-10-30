import type {
  ConversationFormOutputDto,
  ConversationParamsDto,
} from "@caseai-connect/desk-contracts"
import { useQuery } from "@tanstack/react-query"
import { conversationsQueryOptions } from "@/features/history"

/**
 * The forms the agents fill in during a conversation, from the agent's conversations, which the
 * history holds. useQuery: optional data, shown as a button once known, which must not hold the
 * conversation back.
 */
export function useConversationForms(
  conversation: ConversationParamsDto,
): ConversationFormOutputDto[] {
  const { data } = useQuery({
    ...conversationsQueryOptions(conversation),
    select: (conversations) =>
      conversations.find((session) => session.id === conversation.agentSessionId)?.forms ?? [],
  })
  return data ?? []
}
