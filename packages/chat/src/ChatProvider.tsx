import type { ReactNode } from "react"
import type { Chat } from "./api/create-chat"
import { ChatContext } from "./chat-context"

/** Gives the app's chat to the hooks of the package under it. */
export function ChatProvider({ chat, children }: { chat: Chat; children: ReactNode }) {
  return <ChatContext value={chat}>{children}</ChatContext>
}
