import type * as React from "react"
import { cn } from "../lib/cn"

export function ChatActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chat-actions"
      className={cn("flex shrink-0 items-center gap-2 p-2", className)}
      {...props}
    />
  )
}
