import type { ConversationParamsDto } from "@caseai-connect/desk-contracts"
import type { QueryClient } from "@tanstack/react-query"
import { orNotFound } from "@/lib/not-found"
import { loaderStaleTime } from "@/lib/start-query"
import { messagesQueryOptions } from "./api/queries"

/**
 * Loads a conversation's messages for its route. A conversation that does not exist, or that is
 * not the person's, is not found.
 */
export async function loadConversation(
  queryClient: QueryClient,
  conversation: ConversationParamsDto,
): Promise<void> {
  await orNotFound(() =>
    queryClient.query({ ...messagesQueryOptions(conversation), staleTime: loaderStaleTime }),
  )
}
