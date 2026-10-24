import type { ConversationParamsDto } from "@caseai-connect/desk-contracts"
import { useLingui } from "@lingui/react/macro"
import { useQuery } from "@tanstack/react-query"
import { conversationsQueryOptions } from "@/features/history"

/**
 * The open conversation's title, from the agent's conversations, which the history holds: "New
 * conversation" until the agent names it. useQuery: the list the sidebar loads only names the
 * conversation, which must not hold it back.
 */
export function useConversationTitle(conversation: ConversationParamsDto): string {
  const { t } = useLingui()
  const { data: title } = useQuery({
    ...conversationsQueryOptions(conversation),
    select: (conversations) =>
      conversations.find((candidate) => candidate.id === conversation.agentSessionId)?.title,
  })
  return title ?? t`New conversation`
}
