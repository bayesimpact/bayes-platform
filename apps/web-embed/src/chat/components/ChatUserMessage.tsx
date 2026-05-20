import type * as React from "react"
import { cn } from "../lib/cn"

export function ChatUserMessage({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chat-user-message"
      className={cn("flex w-full justify-end", className)}
      {...props}
    >
      <div
        className="max-w-[80%] rounded-2xl px-4 py-3 text-sm text-white whitespace-pre-wrap"
        style={{ backgroundColor: "var(--embed-primary)" }}
      >
        {children}
      </div>
    </div>
  )
}
