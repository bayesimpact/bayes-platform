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
    <div className="max-h-40 overflow-y-auto">
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
          "field-sizing-content w-full resize-none bg-transparent px-4 pt-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  )
}
