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

export function useChatFooter() {
  const context = useContext(ChatFooterContext)
  if (!context) {
    throw new Error("useChatFooter must be used within a ChatFooter")
  }
  return context
}
