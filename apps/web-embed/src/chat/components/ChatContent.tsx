import type * as React from "react"
import { cn } from "../lib/cn"

export function ChatContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chat-content"
      className={cn("flex flex-1 flex-col gap-4 overflow-y-auto p-5", className)}
      {...props}
    />
  )
}
