import type { QueryClient } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"
import { ApiError } from "@/lib/api-client"
import { messagesQueryOptions } from "./api/queries"
import type { ConversationRef } from "./conversation-ref"

/**
 * Loads a conversation's messages for its route. A conversation that does not exist, or that is
 * not the person's, is not found.
 */
export async function loadConversation(
  queryClient: QueryClient,
  conversation: ConversationRef,
): Promise<void> {
  try {
    await queryClient.query({ ...messagesQueryOptions(conversation), staleTime: "static" })
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
      throw notFound()
    }
    throw error
  }
}
