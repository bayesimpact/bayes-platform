import { SendHorizonalIcon } from "lucide-react"
import type * as React from "react"
import { useChatFooter } from "../context"
import { cn } from "../lib/cn"

export function ChatSubmit({
  className,
  onClick,
  disabled,
  ...props
}: React.ComponentProps<"button">) {
  const { onMessageSubmit, input } = useChatFooter()
  const isDisabled = disabled || !input.value.trim()

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    onMessageSubmit(input.value)
    onClick?.(e)
  }

  return (
    <button
      type="button"
      data-slot="chat-submit"
      onClick={handleClick}
      disabled={isDisabled}
      style={{ backgroundColor: "var(--embed-primary)" }}
      className={cn(
        "flex size-8 items-center justify-center rounded-xl text-white transition-all",
        "hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {props.children ?? <SendHorizonalIcon className="size-4" />}
    </button>
  )
}
