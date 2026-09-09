import { InfoIcon } from "lucide-react"
import type * as React from "react"
import { cn } from "../lib/cn"

/**
 * Organization-configured notice pinned above the conversation.
 * Stays visible while the messages scroll, in both the standalone public page and the widget.
 */
export function ChatBanner({
  text,
  className,
  ...props
}: React.ComponentProps<"div"> & { text: string }) {
  return (
    <div
      data-slot="chat-banner"
      role="note"
      className={cn(
        "flex shrink-0 items-start gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-sm text-amber-900",
        className,
      )}
      {...props}
    >
      <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p className="flex-1 whitespace-pre-line break-words">{text}</p>
    </div>
  )
}
