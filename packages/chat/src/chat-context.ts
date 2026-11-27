import { createContext, useContext } from "react"
import type { Chat } from "./api/create-chat"

export const ChatContext = createContext<Chat | null>(null)

/** The chat of the app, which the `ChatProvider` above gives. */
export function useChat(): Chat {
  const chat = useContext(ChatContext)
  if (!chat) throw new Error("useChat must run under a ChatProvider")
  return chat
}
