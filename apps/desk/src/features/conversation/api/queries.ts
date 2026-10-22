import type { ConversationParamsDto, DocumentParamsDto } from "@caseai-connect/desk-contracts"
import { DeskConversationsRoutes, DeskDocumentsRoutes } from "@caseai-connect/desk-contracts"
import { queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { pollWhile } from "@/lib/polling"
import { type ChatMessage, isWriting, toChatMessages } from "../chat-messages"
import { conversationKeys, documentKeys } from "./keys"
import { isReplyStreaming } from "./reply-streams"

/** While the server writes a reply this tab does not stream, the messages refetch this often. */
const RECOVERY_INTERVAL_IN_MILLISECONDS = 2000

/**
 * The messages of a conversation, oldest first. After a reload during a reply, the server keeps
 * writing it: the query then refetches every 2 s, while the tab is visible, until it settles.
 */
export const messagesQueryOptions = (conversation: ConversationParamsDto) =>
  queryOptions({
    queryKey: conversationKeys.messages(conversation.agentSessionId),
    queryFn: async ({ signal }) =>
      toChatMessages(
        await apiRequest(DeskConversationsRoutes.getMessages, { params: conversation, signal }),
      ),
    // Three failures in a row stop the polling: the reply then shows as interrupted.
    refetchInterval: pollWhile((messages: ChatMessage[] | undefined) => {
      if (isReplyStreaming(conversation.agentSessionId)) return false
      const now = Date.now()
      return (messages ?? []).some((message) => isWriting(message, now))
    }, RECOVERY_INTERVAL_IN_MILLISECONDS),
    // A refetch would replace the reply this tab is streaming into the cache.
    refetchOnWindowFocus: () => !isReplyStreaming(conversation.agentSessionId),
  })

/** Whether a document a reply cites is shared with every member of the project. */
export const documentIsPublicQueryOptions = (document: DocumentParamsDto) =>
  queryOptions({
    queryKey: documentKeys.isPublic(document.documentId),
    queryFn: async ({ signal }) =>
      (await apiRequest(DeskDocumentsRoutes.getIsPublic, { params: document, signal }))
        .isPublicDocument,
    staleTime: 5 * 60 * 1000,
  })

/**
 * The current HTML of the MCP Apps the conversation's replies show. The API connects to each MCP
 * server to read it, so it loads after the messages, once a settled reply shows an app.
 */
export const mcpAppsHtmlQueryOptions = (conversation: ConversationParamsDto) =>
  queryOptions({
    queryKey: conversationKeys.mcpApps(conversation.agentSessionId),
    queryFn: ({ signal }) =>
      apiRequest(DeskConversationsRoutes.getMcpAppsHtml, { params: conversation, signal }),
    staleTime: 5 * 60 * 1000,
  })
