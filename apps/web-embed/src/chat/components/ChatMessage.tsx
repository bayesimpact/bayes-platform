import type {
  AgentSessionMcpAppHtmlDto,
  AgentSessionMessageDto,
} from "@caseai-connect/api-contracts"
import { AlertCircleIcon, CopyIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "../lib/cn"
import { ChatBotMessage, ChatUserMessage } from "./index"
import { MarkdownWrapper } from "./MarkdownWrapper"
import { McpAppPlaceholder, McpAppView } from "./McpAppView"
import { getFailedMcpAppFallbackText, getRenderableMcpApp, hasMcpAppCard } from "./mcp-app-view"
import { findSourcesTool, SourcesTool } from "./SourcesTool"
import { Spinner } from "./Spinner"
import {
  findSurfaceResourcesTool,
  hasSurfacedResources,
  SurfaceResourcesTool,
} from "./SurfaceResourcesTool"

export function ChatMessage({
  message,
  mcpAppHtml = [],
  isMcpAppHtmlLoading = false,
}: {
  message: AgentSessionMessageDto
  /** Current HTML of the MCP App cards in the thread, loaded after the messages. */
  mcpAppHtml?: AgentSessionMcpAppHtmlDto[]
  /** The MCP servers have not answered yet: cards without HTML hold their place. */
  isMcpAppHtmlLoading?: boolean
}) {
  // MCP App cards that gave up rendering; their reply text is shown instead.
  const [failedMcpAppToolCallIds, setFailedMcpAppToolCallIds] = useState<string[]>([])

  switch (message.role) {
    case "assistant": {
      const isStreaming = message.status === "streaming"
      // Every card this reply shows, with its view once the HTML is here. A card without a view
      // is either still loading (placeholder) or unavailable (its text stands in).
      const mcpAppCards = (message.toolCalls ?? [])
        .filter(hasMcpAppCard)
        .map((toolCall) => ({ toolCall, view: getRenderableMcpApp(toolCall, mcpAppHtml) }))
      // Cards whose HTML never came, or that gave up rendering: their reply text is shown instead.
      const unavailableMcpAppToolCallIds = [
        ...failedMcpAppToolCallIds,
        ...mcpAppCards
          .filter(({ view }) => view === undefined && !isMcpAppHtmlLoading)
          .map(({ toolCall }) => toolCall.id),
      ]
      const hasContent = message.content.trim().length > 0
      // A card that failed to render must not take the reply text down with it.
      const hideMarkdownRecap =
        !isStreaming &&
        mcpAppCards.some(({ toolCall }) => !unavailableMcpAppToolCallIds.includes(toolCall.id))
      // The model may have written nothing because it expected the card to speak for the tool:
      // once the card gave up, the tool result text stands in for the reply.
      const failedMcpAppFallbackText = hasContent
        ? ""
        : getFailedMcpAppFallbackText(message.toolCalls, unavailableMcpAppToolCallIds)
      const bubbleContent =
        hasContent && !hideMarkdownRecap ? message.content : failedMcpAppFallbackText
      const surfaceResourcesTool = findSurfaceResourcesTool(message.toolCalls)
      const sourcesTool = findSourcesTool(message.toolCalls)
      // A card on screen, loading or rendered even if it later gave up, means the reply is not
      // empty, only quiet. A card whose HTML never came counts as absent.
      const hasCardOnScreen = mcpAppCards.some(
        ({ view }) => view !== undefined || isMcpAppHtmlLoading,
      )
      const isEmpty =
        !hasContent &&
        message.status === "completed" &&
        !hasCardOnScreen &&
        failedMcpAppFallbackText.length === 0 &&
        !hasSurfacedResources(message.toolCalls)
      // "aborted": the stream died with the server before anything was written.
      const isError = message.status === "error" || message.status === "aborted" || isEmpty
      const showTextBubble = isError || isStreaming || bubbleContent.length > 0

      return (
        <div className="flex w-full flex-col">
          {showTextBubble && (
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
                {isError ? <ErrorIndicator /> : <MarkdownWrapper content={bubbleContent} />}
              </div>

              {!isStreaming && !isError && bubbleContent.length > 0 && (
                <div className="mt-1 flex flex-col items-start">
                  <CopyButton content={bubbleContent} />
                  {sourcesTool && <SourcesTool toolCall={sourcesTool} />}
                </div>
              )}
            </ChatBotMessage>
          )}

          {!isStreaming && surfaceResourcesTool && (
            <SurfaceResourcesTool toolCall={surfaceResourcesTool} />
          )}

          {!isStreaming &&
            mcpAppCards.map(({ toolCall, view }) =>
              view ? (
                <McpAppView
                  key={toolCall.id}
                  html={view.html}
                  toolInput={view.toolInput}
                  toolResult={view.toolResult}
                  onRenderFailed={() =>
                    setFailedMcpAppToolCallIds((previous) =>
                      previous.includes(toolCall.id) ? previous : [...previous, toolCall.id],
                    )
                  }
                />
              ) : (
                isMcpAppHtmlLoading && <McpAppPlaceholder key={toolCall.id} className="mt-2" />
              ),
            )}
        </div>
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
