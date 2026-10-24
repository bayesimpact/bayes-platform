import type { ConversationParamsDto } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useState } from "react"
import { CopyButton } from "@/components/shared/CopyButton"
import { Markdown } from "@/components/shared/Markdown"
import { RelativeTime } from "@/components/shared/RelativeTime"
import { Message, MessageContent } from "@/components/ui/message"
import { MemoryProposals } from "@/features/memory"
import { QUOTABLE_ATTRIBUTE } from "../annotation"
import { type ChatMessage, isBeingWritten, isLocalMessageId } from "../chat-messages"
import { type AppsHtml, hasMeaningfulText, toolResultText, unavailableApps } from "../mcp-apps"
import type { OpenedResource } from "../resource-media"
import { FeedbackDialog } from "./FeedbackDialog"
import { McpAppsList } from "./McpAppsList"
import { MessageActions } from "./MessageActions"
import { ReplyError } from "./ReplyError"
import { ResourceCards } from "./ResourceCards"
import { SourcesList } from "./SourcesList"
import { ToolSteps } from "./ToolSteps"

export type AssistantMessageViewProps = {
  conversation: ConversationParamsDto
  message: ChatMessage
  now: number
  /** Whether the project shows the sources of a reply (its `sources-tool` feature). */
  hasSourcesTool: boolean
  appsHtml: AppsHtml
  onAppMessage: (text: string) => void
  /** Opens a resource a reply points to beside the conversation. */
  onOpenResource: (resource: OpenedResource) => void
}

/**
 * A reply of the agent: its steps, its text, and what came with it (MCP App cards, resources,
 * remembered facts, sources), then its actions. A reply whose app cannot render shows the tool's
 * text instead, when its own says nothing.
 */
export function AssistantMessageView({
  conversation,
  message,
  now,
  hasSourcesTool,
  appsHtml,
  onAppMessage,
  onOpenResource,
}: AssistantMessageViewProps) {
  const { t } = useLingui()
  const [failedAppIds, setFailedAppIds] = useState<string[]>([])
  const isWriting = isBeingWritten(message, now)
  const isInterrupted =
    message.status === "aborted" || (message.status === "streaming" && !isWriting)
  const text =
    message.mcpApps.length > 0 && !isWriting
      ? replyTextWithApps(message, unavailableApps(message.mcpApps, appsHtml, failedAppIds))
      : message.content

  return (
    <Message>
      <MessageContent className="gap-3">
        <ToolSteps toolNames={message.toolNames} isWriting={isWriting} hasText={text !== ""} />
        {message.status === "error" ? <ReplyError message={message} /> : null}
        {message.status !== "error" && text !== "" ? (
          // A passage of a settled reply can be annotated.
          <div {...(isWriting ? {} : { [QUOTABLE_ATTRIBUTE]: "" })}>
            <Markdown isStreaming={isWriting}>{text}</Markdown>
          </div>
        ) : null}
        {message.mcpApps.length > 0 && !isWriting ? (
          <McpAppsList
            apps={message.mcpApps}
            appsHtml={appsHtml}
            failedAppIds={failedAppIds}
            onAppMessage={onAppMessage}
            onAppFailed={(toolCallId) =>
              setFailedAppIds((current) =>
                current.includes(toolCallId) ? current : [...current, toolCallId],
              )
            }
          />
        ) : null}
        {message.resources.length > 0 ? (
          <ResourceCards resources={message.resources} onOpenResource={onOpenResource} />
        ) : null}
        {message.memoryIds.length > 0 ? (
          <MemoryProposals agent={conversation} memoryIds={message.memoryIds} />
        ) : null}
        {hasSourcesTool && message.sources.length > 0 ? (
          <SourcesList conversation={conversation} sources={message.sources} />
        ) : null}
        {isInterrupted ? (
          <p className="text-sm text-muted-foreground">
            <Trans>This reply was interrupted before it finished.</Trans>
          </p>
        ) : null}
        {message.status === "completed" && text !== "" ? (
          <MessageActions>
            <CopyButton text={text} label={t`Copy the reply`} />
            {/* A local reply gets its id once the persisted messages replace it. */}
            {isLocalMessageId(message.id) ? null : (
              <FeedbackDialog conversation={conversation} agentMessageId={message.id} />
            )}
            {message.createdAt !== null ? (
              <RelativeTime
                moment={message.createdAt}
                now={now}
                className="px-1 text-xs font-normal"
              />
            ) : null}
          </MessageActions>
        ) : null}
      </MessageContent>
    </Message>
  )
}

/**
 * The text of a reply that shows apps: its own when it says something, else the text of the
 * tools whose app cannot render, so the person still reads their answer.
 */
function replyTextWithApps(message: ChatMessage, unavailable: ChatMessage["mcpApps"]): string {
  if (hasMeaningfulText(message.content)) return message.content
  return unavailable
    .map((app) => toolResultText(app.toolResult))
    .filter((appText) => appText !== "")
    .join("\n\n")
}
