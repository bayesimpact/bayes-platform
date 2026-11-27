import type { ApiClient, readServerSentEvents } from "@caseai-connect/api-client"
import type {
  ConversationParamsDto,
  ConversationRoutes,
  DocumentsRoutes,
} from "@caseai-connect/chat-contracts"
import type { QueryClient } from "@tanstack/react-query"

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
