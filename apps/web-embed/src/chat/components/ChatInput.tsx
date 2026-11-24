import type * as React from "react"
import { useChatFooter } from "../context"
import { cn } from "../lib/cn"

export function ChatInput({
  className,
  onKeyDown,
  onChange,
  placeholder,
  ...props
}: React.ComponentProps<"textarea">) {
  const { input, onMessageSubmit } = useChatFooter()

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && input.value.trim()) {
      e.preventDefault()
      onMessageSubmit(input.value)
    }
    onKeyDown?.(e)
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    input.setValue(e.target.value)
    onChange?.(e)
  }

  return (
    <div className="max-h-40 min-w-0 flex-1 overflow-y-auto">
      <textarea
        ref={input.ref}
        data-slot="chat-input"
        value={input.value}
        rows={1}
        placeholder={placeholder}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={input.disabled || props.disabled}
        className={cn(
          // One line is 48px high, like the row of buttons beside it: 20px of text and 28px of
          // padding, or 24px and 24px on a touch screen.
          "field-sizing-content block w-full resize-none bg-transparent py-3.5 pr-1 pl-4 pointer-coarse:py-3 text-sm text-gray-900 pointer-coarse:text-base placeholder:text-gray-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  )
}
