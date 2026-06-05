import { ToolName } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { Spinner } from "@caseai-connect/ui/shad/spinner"
import { cn } from "@caseai-connect/ui/utils"
import { AlertCircleIcon, CopyIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { FeedbackCreator } from "@/common/components/FeedbackCreator"
import { RestrictedFeature } from "@/common/components/RestrictedFeature"
import type { AgentSessionMessage as AgentSessionMessageType } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/agent-session-messages.models"
import { useCopyToClipboard } from "@/common/hooks/use-copy-to-clipboard"
import { Attachment } from "./Attachment"
import { ChatBotMessage, ChatUserMessage } from "./Chat"
import { MarkdownWrapper } from "./MarkdownWrapper"
import { SourcesTool } from "./SourcesTool"

export function AgentSessionMessage({ message }: { message: AgentSessionMessageType }) {
  switch (message.role) {
    case "assistant": {
      const isStreaming = message.status === "streaming"
      const isEmpty = message.content.trim().length === 0 && message.status === "completed"
      const isError = message.status === "error" || isEmpty
      const sourcesTool = message.toolCalls?.find((call) => call.name === ToolName.Sources)
      return (
        <div key={message.id} className="max-w-3/4 relative">
          <ChatBotMessage>
            <div
              className={cn(
                "rounded-2xl p-4 bg-muted w-fit h-fit",
                isError && "bg-red-50 border border-red-200 text-red-800",
              )}
            >
              {isStreaming && <ThinkingMessage />}
              {isError ? <ErrorMessage /> : <MarkdownWrapper content={message.content} />}
            </div>

            {!isStreaming && (
              <div className="w-full mt-1 flex items-center">
                <FeedbackCreator message={message} />

                <CopyToClipboard content={message.content} />

                <RestrictedFeature feature="sources-tool">
                  {sourcesTool && <SourcesTool toolCall={sourcesTool} />}
                </RestrictedFeature>
              </div>
            )}
          </ChatBotMessage>
        </div>
      )
    }
    case "user":
      return (
        <div className="flex flex-col gap-2 items-end">
          <ChatUserMessage key={message.id}>{message.content}</ChatUserMessage>
          <Attachment message={message} />
        </div>
      )

    default:
      return null
  }
}

function ErrorMessage() {
  const { t } = useTranslation("status")
  return (
    <div className="flex items-center gap-2 mb-2 w-30">
      <AlertCircleIcon className="size-4 text-red-600" />
      <span className="font-semibold text-red-700">{t("error")}</span>
    </div>
  )
}

function ThinkingMessage({ className }: { className?: string }) {
  const { t } = useTranslation("status")
  return (
    <div className={cn("flex items-center gap-2 mb-2 animate-pulse", className)}>
      <Spinner />
      <span>{t("thinking")}</span>
    </div>
  )
}

function CopyToClipboard({ content }: { content: string }) {
  const { copy, isCopied } = useCopyToClipboard("Copied to clipboard!")
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground"
      disabled={isCopied}
      onClick={() => void copy(content)}
    >
      <CopyIcon className="size-3.5" />
    </Button>
  )
}
