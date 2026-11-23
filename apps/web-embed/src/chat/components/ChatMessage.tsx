import type {
  AgentSessionMcpAppHtmlDto,
  AgentSessionMessageDto,
} from "@caseai-connect/api-contracts"
import { AlertCircleIcon, CheckIcon, CopyIcon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "../lib/cn"
import { DotGridLoader } from "./DotGrid"
import { FollowUpQuestions, findFollowUpQuestions } from "./FollowUpQuestions"
import { ChatBotMessage, ChatUserMessage } from "./index"
import { MarkdownWrapper } from "./MarkdownWrapper"
import { McpAppPlaceholder, McpAppView } from "./McpAppView"
import { getRenderableMcpApp, getReplyBubbleText, hasMcpAppCard } from "./mcp-app-view"
import { findSourcesTool, SourcesTool } from "./SourcesTool"
import {
  findSurfaceResourcesTool,
  hasSurfacedResources,
  SurfaceResourcesTool,
} from "./SurfaceResourcesTool"

export function ChatMessage({
  message,
  mcpAppHtml = [],
  isMcpAppHtmlLoading = false,
  onFollowUpSelect,
}: {
  message: AgentSessionMessageDto
  /** Sends a suggested follow-up question. Only passed to the last reply of the thread. */
  onFollowUpSelect?: (question: string) => void
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
      // The reply text stays on screen next to its cards. The model may have written nothing
      // because it expected the card to speak for the tool: once the card gave up, the tool
      // result text stands in for the reply.
      const bubbleContent = getReplyBubbleText(
        message.content,
        message.toolCalls,
        unavailableMcpAppToolCallIds,
      )
      const surfaceResourcesTool = findSurfaceResourcesTool(message.toolCalls)
      const sourcesTool = findSourcesTool(message.toolCalls)
      // A card on screen, loading or rendered even if it later gave up, means the reply is not
      // empty, only quiet. A card whose HTML never came counts as absent.
      const hasCardOnScreen = mcpAppCards.some(
        ({ view }) => view !== undefined || isMcpAppHtmlLoading,
      )
      const isEmpty =
        message.status === "completed" &&
        !hasCardOnScreen &&
        bubbleContent.length === 0 &&
        !hasSurfacedResources(message.toolCalls)
      // "aborted": the stream died with the server before anything was written.
      const isError = message.status === "error" || message.status === "aborted" || isEmpty
      const showTextBubble = isError || isStreaming || bubbleContent.length > 0
      const isCopyable = !isStreaming && !isError && bubbleContent.length > 0

      return (
        <div className="flex w-full flex-col">
          {showTextBubble && (
            <ChatBotMessage>
              <div
                className={cn(
                  "group relative rounded-2xl p-4 text-sm",
                  // The copy button sits in the bubble's bottom-right corner, inside a bottom
                  // padding of its own, so it never covers the last line of text.
                  isCopyable && "pb-7",
                  isError
                    ? "border border-red-200 bg-red-50 text-red-800"
                    : "bg-gray-100 text-gray-900",
                )}
              >
                {isStreaming && message.content.trim().length === 0 && <ThinkingIndicator />}
                {isError ? <ErrorIndicator /> : <MarkdownWrapper content={bubbleContent} />}
                {isCopyable && <CopyButton content={bubbleContent} />}
              </div>

              {!isStreaming && !isError && bubbleContent.length > 0 && sourcesTool && (
                <div className="mt-1 flex flex-col items-start">
                  <SourcesTool toolCall={sourcesTool} />
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
                  csp={view.csp}
                  mcpServerId={view.mcpServerId}
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

          {!isStreaming && !isError && onFollowUpSelect && (
            <FollowUpQuestions
              questions={findFollowUpQuestions(message.toolCalls)}
              onSelect={onFollowUpSelect}
            />
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
    <div className="flex items-center gap-2.5 text-gray-500 text-sm">
      <DotGridLoader />
      <span className="embed-shimmer">{t("message.thinking")}</span>
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
      title={t("message.copyAriaLabel")}
      onClick={() => void handleClick()}
      className="absolute right-2 bottom-1 flex size-6 items-center justify-center rounded-md text-gray-400 opacity-0 transition hover:bg-gray-200 hover:text-gray-700 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-100 [@media(hover:none)]:opacity-70"
    >
      {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
    </button>
  )
}
