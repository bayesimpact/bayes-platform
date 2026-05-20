import type * as React from "react"
import { cn } from "../lib/cn"

export function ChatActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chat-actions"
      className={cn("flex w-full items-center justify-end gap-2 p-2", className)}
      {...props}
    />
  )
}
