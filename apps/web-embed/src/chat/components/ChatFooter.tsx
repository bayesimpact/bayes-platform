import * as React from "react"
import { ChatFooterContext } from "../context"
import { cn } from "../lib/cn"

const isTouchScreen = () => window.matchMedia("(pointer: coarse)").matches

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
    if (isTouchScreen()) return
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  const handleSubmit = React.useCallback(
    (value: string) => {
      if (!value.trim()) return
      onMessageSubmit(value)
      setInputValue("")
      // Back to the message box with a mouse and keyboard. A touch screen keeps what it had: the
      // keyboard stays open if it was, and sending with it folded away does not bring it back.
      if (!isTouchScreen()) inputRef.current?.focus({ preventScroll: true })
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
            // One row: the message box takes one line when empty and grows with the text, and the
            // buttons stay on its last line.
            "m-4 flex cursor-text items-end rounded-2xl border-2 transition-colors",
            isFocused ? "border-[var(--embed-accent)]" : "border-gray-200",
            className,
          )}
          onClick={(event) => {
            // The frame around the message box focuses it, not the buttons it holds.
            if ((event.target as HTMLElement).closest("button")) return
            inputRef.current?.focus({ preventScroll: true })
          }}
          {...props}
        >
          {children}
        </div>
      </div>
    </ChatFooterContext.Provider>
  )
}
