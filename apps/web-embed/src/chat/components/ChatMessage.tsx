import type { AgentSessionMessageDto } from "@caseai-connect/api-contracts"
import { AlertCircleIcon, CopyIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "../lib/cn"
import { ChatBotMessage, ChatUserMessage } from "./index"
import { MarkdownWrapper } from "./MarkdownWrapper"

export function ChatMessage({ message }: { message: AgentSessionMessageDto }) {
  switch (message.role) {
    case "assistant": {
      const isStreaming = message.status === "streaming"
      const isEmpty = message.content.trim().length === 0 && message.status === "completed"
      const isError = message.status === "error" || isEmpty

      return (
        <ChatBotMessage>
          <div
            className={cn(
              "rounded-2xl p-4 text-sm",
              isError
                ? "border border-red-200 bg-red-50 text-red-800"
                : "bg-gray-100 text-gray-900",
            )}
          >
            {isStreaming && message.content.trim().length === 0 && <ThinkingIndicator />}
            {isError ? <ErrorIndicator /> : <MarkdownWrapper content={message.content} />}
          </div>

          {!isStreaming && !isError && message.content.trim().length > 0 && (
            <div className="mt-1 flex items-center">
              <CopyButton content={message.content} />
            </div>
          )}
        </ChatBotMessage>
      )
    }

    case "user":
      return <ChatUserMessage>{message.content}</ChatUserMessage>

    default:
      return null
  }
}

function ThinkingIndicator() {
  const { t } = useTranslation("chat")
  return (
    <div className="flex animate-pulse items-center gap-2 text-gray-500 text-sm">
      <Spinner />
      <span>{t("message.thinking")}</span>
    </div>
  )
}

function ErrorIndicator() {
  const { t } = useTranslation("chat")
  return (
    <div className="flex items-center gap-2 text-red-700 text-sm">
      <AlertCircleIcon className="size-4 shrink-0 text-red-600" />
      <span className="font-semibold">{t("message.error")}</span>
    </div>
  )
}

function Spinner() {
  return (
    <svg
      role="img"
      aria-label="Loading"
      className="size-4 animate-spin text-gray-400"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

function CopyButton({ content }: { content: string }) {
  const { t } = useTranslation("chat")
  const [copied, setCopied] = useState(false)

  const handleClick = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      aria-label={t("message.copyAriaLabel")}
      disabled={copied}
      onClick={() => void handleClick()}
      className="flex size-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
    >
      <CopyIcon className="size-3.5" />
    </button>
  )
}
