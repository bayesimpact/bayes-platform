import { Button } from "@caseai-connect/ui/shad/button"
import { Textarea } from "@caseai-connect/ui/shad/textarea"
import { cn } from "@caseai-connect/ui/utils"
import { Slot } from "@radix-ui/react-slot"
import { SendHorizonalIcon, SparklesIcon } from "lucide-react"
import * as React from "react"
import { useTranslation } from "react-i18next"
import { ChatFooterContext, useChatFooter } from "./context"

function Chat({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chat"
      className={cn(
        "relative flex flex-1 h-full flex-col shadow-xl rounded-2xl overflow-hidden bg-white",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function ChatHeader({ className, children, ...props }: React.ComponentProps<"div">) {
  const { t } = useTranslation()
  return (
    <div
      data-slot="chat-header"
      className={cn("bg-primary text-white h-20 flex items-center px-6 gap-4", className)}
      {...props}
    >
      <div className="border border-muted rounded-full p-2">
        <SparklesIcon className="size-6" />
      </div>
      <div className="flex-1">{t("conversationAgentSession:chat.title")}</div>
      <div>{children}</div>
    </div>
  )
}

function ChatBotMessage({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="chat-bot-message" className={cn("w-fit h-fit", className)} {...props} />
}

function ChatUserMessage({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chat-user-message"
      className={cn("flex w-full justify-end", className)}
      {...props}
    >
      <div className="w-fit flex items-center justify-end max-w-2/3">
        <div className="rounded-2xl text-white p-4 bg-primary h-fit w-fit justify-end whitespace-break-spaces">
          {children}
        </div>
      </div>
    </div>
  )
}

function ChatContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chat-content"
      className={cn("p-6 flex flex-col gap-4 overflow-y-auto flex-1 min-h-0", className)}
      {...props}
    />
  )
}

function ChatFooter({
  onMessageSubmit,
  focus,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  onMessageSubmit: (value: string) => void
  focus: boolean
}) {
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  const [inputValue, setInputValue] = React.useState("")
  const [disabled, setDisabled] = React.useState(false)

  const [isFocused, setIsFocused] = React.useState(false)

  React.useEffect(() => {
    const handleFocus = () => {
      setIsFocused(true)
    }
    const handleBlur = () => {
      setIsFocused(false)
    }
    const inputElem = inputRef.current
    if (inputElem) {
      inputElem.addEventListener("focus", handleFocus)
      inputElem.addEventListener("blur", handleBlur)
    }
    return () => {
      if (inputElem) {
        inputElem.removeEventListener("focus", handleFocus)
        inputElem.removeEventListener("blur", handleBlur)
      }
    }
  }, [])

  React.useEffect(() => {
    if (focus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [focus])

  const handleSubmit = React.useCallback(
    (value: string) => {
      if (!value.trim()) return
      onMessageSubmit?.(value)
      setInputValue("")
      if (inputRef.current) {
        inputRef.current.focus()
      }
    },
    [onMessageSubmit],
  )

  const handleClick = () => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  return (
    <ChatFooterContext.Provider
      value={{
        input: {
          value: inputValue,
          setValue: setInputValue,
          ref: inputRef,
          disabled,
          setDisabled,
        },
        onMessageSubmit: handleSubmit,
      }}
    >
      <div className="flex h-fit">
        {/** biome-ignore lint/a11y/useKeyWithClickEvents: to allow onClick on Div */}
        {/** biome-ignore lint/a11y/noStaticElementInteractions: to allow onClick on Div */}
        <div
          data-slot="chat-footer"
          className={cn(
            "flex-1 border-2 m-6 rounded-2xl flex items-center flex-col cursor-text",
            isFocused ? "border-primary" : "border-muted",
            className,
          )}
          {...props}
          onClick={handleClick}
        >
          {children}
        </div>
      </div>
    </ChatFooterContext.Provider>
  )
}

function ChatActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="chat-actions"
      className={cn("p-2 flex flex-1 items-center justify-end w-full gap-4", className)}
      {...props}
    />
  )
}

function ChatInput({
  className,
  onKeyDown,
  onChange,
  ...props
}: React.ComponentProps<typeof Textarea>) {
  const { input, onMessageSubmit } = useChatFooter()

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!input.value.trim()) return

    if (e.key === "Enter" && !e.shiftKey) {
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
    <div className="max-h-60 overflow-hidden overflow-y-auto w-full">
      <Textarea
        ref={input.ref}
        data-slot="chat-input"
        value={input.value}
        rows={1}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        {...props}
        className={cn("border-none min-h-min shadow-none focus-visible:ring-0", className)}
        disabled={input.disabled || props.disabled}
      />
    </div>
  )
}

function ChatSubmit({
  asChild = false,
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button> & {
  asChild?: boolean
}) {
  const { onMessageSubmit, input } = useChatFooter()

  const isInputEmpty = !input.value.trim()

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    onMessageSubmit(input.value)
    onClick?.(e)
  }
  if (asChild)
    return (
      <Slot
        data-slot="chat-submit"
        onClick={handleClick}
        className={cn(className)}
        disabled={isInputEmpty}
        {...props}
      />
    )
  return (
    <Button
      data-slot="chat-submit"
      onClick={handleClick}
      className={cn(className)}
      {...props}
      disabled={isInputEmpty}
    >
      {props.children ? props.children : <SendHorizonalIcon className="size-5" />}
    </Button>
  )
}

export {
  Chat,
  ChatActions,
  ChatBotMessage,
  ChatContent,
  ChatFooter,
  ChatHeader,
  ChatInput,
  ChatSubmit,
  ChatUserMessage,
}
