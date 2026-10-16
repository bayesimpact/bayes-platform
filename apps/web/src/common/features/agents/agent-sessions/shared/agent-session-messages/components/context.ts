import { createContext, useContext } from "react"

interface ChatFooterContextValue {
  onMessageSubmit: (value: string) => void
  input: {
    value: string
    setValue: React.Dispatch<React.SetStateAction<string>>
    ref: React.RefObject<HTMLTextAreaElement | null>
    disabled: boolean
    setDisabled: React.Dispatch<React.SetStateAction<boolean>>
  }
}

export const ChatFooterContext = createContext<ChatFooterContextValue | null>(null)

/**
 * Puts text in the chat input, for the user to read and send: how a message an MCP App proposes
 * (`ui/message`) reaches the conversation. Absent where the thread has no input.
 */
export const ChatDraftContext = createContext<((text: string) => void) | null>(null)

export function useChatFooter() {
  const context = useContext(ChatFooterContext)
  if (!context) {
    throw new Error("useChatFooter must be used within a ChatFooter")
  }
  return context
}
