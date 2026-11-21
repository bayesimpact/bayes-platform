import * as React from "react"
import { ChatFooterContext } from "../context"
import { cn } from "../lib/cn"

export function ChatFooter({
  onMessageSubmit,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  onMessageSubmit: (value: string) => void
}) {
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const [inputValue, setInputValue] = React.useState("")
  const [disabled, setDisabled] = React.useState(false)
  const [isFocused, setIsFocused] = React.useState(false)

  React.useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const onFocus = () => setIsFocused(true)
    const onBlur = () => setIsFocused(false)
    el.addEventListener("focus", onFocus)
    el.addEventListener("blur", onBlur)
    return () => {
      el.removeEventListener("focus", onFocus)
      el.removeEventListener("blur", onBlur)
    }
  }, [])

  // Ready to type when the chat appears, with a mouse and keyboard. Not on a touch screen: focus
  // there opens the on-screen keyboard over the page, even while the chat is closed.
  React.useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  const handleSubmit = React.useCallback(
    (value: string) => {
      if (!value.trim()) return
      onMessageSubmit(value)
      setInputValue("")
      inputRef.current?.focus({ preventScroll: true })
    },
    [onMessageSubmit],
  )

  return (
    <ChatFooterContext.Provider
      value={{
        input: { value: inputValue, setValue: setInputValue, ref: inputRef, disabled, setDisabled },
        onMessageSubmit: handleSubmit,
      }}
    >
      <div className="shrink-0">
        {/** biome-ignore lint/a11y/useKeyWithClickEvents: focus helper */}
        {/** biome-ignore lint/a11y/noStaticElementInteractions: focus helper */}
        <div
          data-slot="chat-footer"
          className={cn(
            "m-4 flex cursor-text flex-col rounded-2xl border-2 transition-colors",
            isFocused ? "border-[var(--embed-accent)]" : "border-gray-200",
            className,
          )}
          onClick={() => inputRef.current?.focus({ preventScroll: true })}
          {...props}
        >
          {children}
        </div>
      </div>
    </ChatFooterContext.Provider>
  )
}
