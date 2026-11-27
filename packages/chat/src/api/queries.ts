import type {
  ConversationParamsDto,
  DocumentParamsDto,
  McpAppHtmlOutputDto,
} from "@caseai-connect/chat-contracts"
import { pollWhile } from "@caseai-connect/frontend-lib"
import { queryOptions } from "@tanstack/react-query"
import { type ChatMessage, isBeingWritten, toChatMessages } from "../chat-messages"
import type { ChatOptions } from "./chat-options"
import { chatKeys } from "./keys"
import type { ReplyStreams } from "./reply-streams"

/** While the server writes a reply this tab does not stream, the messages refetch this often. */
const RECOVERY_INTERVAL_IN_MILLISECONDS = 2000

/** The queries of the chat, on the routes and the client its app gave it. */
export function createChatQueries(
  { routes, api }: Pick<ChatOptions, "routes" | "api">,
  replyStreams: ReplyStreams,
) {
  return {
    /**
     * The messages of a conversation, oldest first. After a reload during a reply, the server
     * keeps writing it: the query then refetches every 2 s, while the tab is visible, until it
     * settles.
     */
    messagesQueryOptions: (conversation: ConversationParamsDto) =>
      queryOptions({
        queryKey: chatKeys.messages(conversation.agentSessionId),
        queryFn: async ({ signal }): Promise<ChatMessage[]> =>
          toChatMessages(
            await api.apiRequest(routes.conversation.getMessages, {
              params: conversation,
              signal,
            }),
          ),
        // Three failures in a row stop the polling: the reply then shows as interrupted.
        refetchInterval: pollWhile((messages: ChatMessage[] | undefined) => {
          if (replyStreams.isStreaming(conversation.agentSessionId)) return false
          const now = Date.now()
          return (messages ?? []).some((message) => isBeingWritten(message, now))
        }, RECOVERY_INTERVAL_IN_MILLISECONDS),
        // A refetch would replace the reply this tab is streaming into the cache.
        refetchOnWindowFocus: () => !replyStreams.isStreaming(conversation.agentSessionId),
      }),

    /**
     * The current HTML of the MCP Apps the conversation's replies show. The API connects to each
     * MCP server to read it, so it loads after the messages, once a settled reply shows an app.
     */
    mcpAppsHtmlQueryOptions: (conversation: ConversationParamsDto) =>
      queryOptions({
        queryKey: chatKeys.mcpApps(conversation.agentSessionId),
        queryFn: ({ signal }): Promise<McpAppHtmlOutputDto[]> =>
          api.apiRequest(routes.conversation.getMcpAppsHtml, { params: conversation, signal }),
        staleTime: 5 * 60 * 1000,
      }),

    /** Whether a document a reply cites is shared with every member of the project. */
    documentIsPublicQueryOptions: (document: DocumentParamsDto) =>
      queryOptions({
        queryKey: chatKeys.documentIsPublic(document.documentId),
        queryFn: async ({ signal }) =>
          (await api.apiRequest(routes.documents.getIsPublic, { params: document, signal }))
            .isPublicDocument,
        staleTime: 5 * 60 * 1000,
      }),
  }
}
