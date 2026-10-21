import type { ConversationFormOutputDto } from "@caseai-connect/desk-contracts"
import { useQuery } from "@tanstack/react-query"
import { conversationsQueryOptions } from "@/features/history"
import type { ConversationRef } from "../conversation-ref"

/**
 * The forms the agents fill in during a conversation, from the agent's conversations, which the
 * history holds. useQuery: optional data, shown as a button once known, which must not hold the
 * conversation back.
 */
export function useConversationForms(conversation: ConversationRef): ConversationFormOutputDto[] {
  const { data } = useQuery({
    ...conversationsQueryOptions({
      organizationId: conversation.organizationId,
      projectId: conversation.projectId,
      agentId: conversation.agentId,
      type: "conversation",
    }),
    select: (conversations) =>
      conversations.find((session) => session.id === conversation.agentSessionId)?.forms ?? [],
  })
  return data ?? []
}
