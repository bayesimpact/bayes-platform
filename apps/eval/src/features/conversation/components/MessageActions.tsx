import type { ReactNode } from "react"
import { MessageFooter } from "@/components/ui/message"

export type MessageActionsProps = {
  children: ReactNode
}

/**
 * The actions under a message, as in the Claude app: they show when the pointer is over the
 * message or the keyboard is in them; a touch screen, with no fine pointer to hover, always
 * shows them. They line up with the message, on the right for the person's.
 */
export function MessageActions({ children }: MessageActionsProps) {
  return (
    <MessageFooter className="gap-0.5 px-0 transition-opacity duration-150 pointer-fine:opacity-0 pointer-fine:group-hover/message:opacity-100 pointer-fine:focus-within:opacity-100">
      {children}
    </MessageFooter>
  )
}
