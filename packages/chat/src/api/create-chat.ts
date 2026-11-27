import type { ApiClient, readServerSentEvents } from "@caseai-connect/api-client"
import type {
  ConversationParamsDto,
  ConversationRoutes,
  DocumentsRoutes,
  MessageFeedbackInputDto,
  MessageParamsDto,
} from "@caseai-connect/chat-contracts"
import type { QueryClient } from "@tanstack/react-query"
import type { OutgoingMessage } from "../chat-messages"
import { chatKeys } from "./keys"
import { createChatQueries } from "./queries"
import { createReplyStreams } from "./reply-streams"
import { streamReply } from "./stream-reply"

/** The API client an app gives its chat: its calls, and the reader of the streams it opens. */
export type ChatApi = Pick<ApiClient, "apiRequest" | "apiStreamResponse"> & {
  readServerSentEvents: typeof readServerSentEvents
}

/** What an app gives its chat: where the API is, and what the app does when the chat moves. */
export type ChatOptions = {
  routes: { conversation: ConversationRoutes; documents: DocumentsRoutes }
  api: ChatApi
  /** Called each time the stream of a reply names a tool the agent calls. */
  onToolCalled?: (
    queryClient: QueryClient,
    conversation: ConversationParamsDto,
    toolName: string,
  ) => void
  /** Called once when a turn is over: its reply ended, failed or was stopped. */
  onReplySettled?: (queryClient: QueryClient, conversation: ConversationParamsDto) => void
}

/** The chat of an app: its query keys and queries, and the state of the replies it streams. */
export type Chat = ReturnType<typeof createChatQueries> & {
  keys: typeof chatKeys
  stopReplyStream: (agentSessionId: string) => void
  /**
   * Sends a message and streams the replies into the conversation's messages in the query cache.
   * Resolves once the stream is over, whatever way it ended.
   */
  streamReply: (
    queryClient: QueryClient,
    conversation: ConversationParamsDto,
    outgoing: OutgoingMessage,
  ) => Promise<void>
  /** Gives a thumbs-up to one of the agent's replies, or reports a problem with it. */
  sendFeedback: (
    conversation: ConversationParamsDto,
    input: Pick<MessageParamsDto, "agentMessageId"> & { feedback: MessageFeedbackInputDto },
  ) => Promise<{ success: boolean }>
  /** The short-lived URL of a document a reply cites. */
  getDocumentUrl: (conversation: ConversationParamsDto, documentId: string) => Promise<string>
  /** The short-lived URL of the file a person attached to a message. */
  getAttachmentUrl: (
    conversation: ConversationParamsDto,
    attachmentDocumentId: string,
  ) => Promise<string>
}

/** Creates the one chat of an app, which its `ChatProvider` gives to the hooks under it. */
export function createChat(options: ChatOptions): Chat {
  const replyStreams = createReplyStreams()
  const queries = createChatQueries(options, replyStreams)
  const context = { options, replyStreams, messagesQueryOptions: queries.messagesQueryOptions }
  return {
    keys: chatKeys,
    ...queries,
    stopReplyStream: replyStreams.stop,
    streamReply: (queryClient, conversation, outgoing) =>
      streamReply(context, queryClient, conversation, outgoing),
    sendFeedback: (conversation, { agentMessageId, feedback }) =>
      options.api.apiRequest(options.routes.conversation.createMessageFeedback, {
        params: { ...conversation, agentMessageId },
        body: feedback,
      }),
    getDocumentUrl: async (conversation, documentId) => {
      const { url } = await options.api.apiRequest(options.routes.documents.getTemporaryUrl, {
        params: { ...conversation, documentId },
      })
      return url
    },
    getAttachmentUrl: async (conversation, attachmentDocumentId) => {
      const { url } = await options.api.apiRequest(options.routes.conversation.getAttachmentUrl, {
        params: { ...conversation, attachmentDocumentId },
      })
      return url
    },
  }
}
