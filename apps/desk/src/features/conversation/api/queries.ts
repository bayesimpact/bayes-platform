import { DeskConversationsRoutes } from "@caseai-connect/desk-contracts"
import { queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { isWriting, toChatMessages } from "../chat-messages"
import type { ConversationRef } from "../conversation-ref"
import { conversationKeys } from "./keys"
import { isReplyStreaming } from "./reply-streams"

/** While the server writes a reply this tab does not stream, the messages refetch this often. */
const RECOVERY_INTERVAL_IN_MILLISECONDS = 2000

/**
 * The messages of a conversation, oldest first. After a reload during a reply, the server keeps
 * writing it: the query then refetches every 2 s, while the tab is visible, until it settles.
 */
export const messagesQueryOptions = (conversation: ConversationRef) =>
  queryOptions({
    queryKey: conversationKeys.messages(conversation.agentSessionId),
    queryFn: async ({ signal }) =>
      toChatMessages(
        await apiRequest(DeskConversationsRoutes.getMessages, { params: conversation, signal }),
      ),
    refetchInterval: (query) => {
      if (isReplyStreaming(conversation.agentSessionId)) return false
      const now = Date.now()
      const isServerWriting = (query.state.data ?? []).some((message) => isWriting(message, now))
      // Three failures in a row stop the polling: the reply then shows as interrupted.
      return isServerWriting && query.state.fetchFailureCount < 3
        ? RECOVERY_INTERVAL_IN_MILLISECONDS
        : false
    },
    // A refetch would replace the reply this tab is streaming into the cache.
    refetchOnWindowFocus: () => !isReplyStreaming(conversation.agentSessionId),
  })
