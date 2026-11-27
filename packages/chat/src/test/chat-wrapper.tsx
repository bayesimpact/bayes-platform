import { QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import type { Chat } from "../api/create-chat"
import { ChatProvider } from "../ChatProvider"
import { createTestChat, createTestQueryClient } from "./test-chat"

/**
 * A wrapper for `renderHook`: a query client that never retries and a chat on the test routes,
 * both given back so a spec can read the cache.
 */
export function createChatWrapper(chat: Chat = createTestChat()) {
  const queryClient = createTestQueryClient()
  function ChatWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ChatProvider chat={chat}>{children}</ChatProvider>
      </QueryClientProvider>
    )
  }
  return { wrapper: ChatWrapper, queryClient, chat }
}
