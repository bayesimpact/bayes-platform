import type * as React from "react"
import { cn } from "../lib/cn"

export function ChatBotMessage({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="chat-bot-message" className={cn("w-fit max-w-[80%]", className)} {...props} />
  )
}
