import { Trans } from "@lingui/react/macro"
import { useState } from "react"
import { Markdown } from "@/components/shared/Markdown"
import { Message, MessageContent, MessageFooter } from "@/components/ui/message"
import { MemoryProposals } from "@/features/memory"
import { type ChatMessage, isWriting } from "../chat-messages"
import type { ConversationRef } from "../conversation-ref"
import { type AppsHtml, hasMeaningfulText, toolResultText, unavailableApps } from "../mcp-apps"
import { CopyButton } from "./CopyButton"
import { FeedbackDialog } from "./FeedbackDialog"
import { McpAppsList } from "./McpAppsList"
import { ReplyError } from "./ReplyError"
import { ResourceCards } from "./ResourceCards"
import { SourcesList } from "./SourcesList"
import { ToolSteps } from "./ToolSteps"

export type AssistantMessageViewProps = {
  conversation: ConversationRef
  message: ChatMessage
  now: number
  /** Whether the project shows the sources of a reply (its `sources-tool` feature). */
  showSources: boolean
  appsHtml: AppsHtml
  onAppMessage: (text: string) => void
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
  showSources,
  appsHtml,
  onAppMessage,
}: AssistantMessageViewProps) {
  const [failedAppIds, setFailedAppIds] = useState<string[]>([])
  const writing = isWriting(message, now)
  const isInterrupted = message.status === "aborted" || (message.status === "streaming" && !writing)
  const text =
    message.mcpApps.length > 0 && !writing
      ? replyTextWithApps(message, unavailableApps(message.mcpApps, appsHtml, failedAppIds))
      : message.content
  const memoryAgent = {
    organizationId: conversation.organizationId,
    projectId: conversation.projectId,
    agentId: conversation.agentId,
  }

  return (
    <Message>
      <MessageContent className="gap-3">
        <ToolSteps toolNames={message.toolNames} isWriting={writing} hasText={text !== ""} />
        {message.status === "error" ? <ReplyError message={message} /> : null}
        {message.status !== "error" && text !== "" ? (
          <Markdown isStreaming={writing}>{text}</Markdown>
        ) : null}
        {message.mcpApps.length > 0 && !writing ? (
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
        {message.resources.length > 0 ? <ResourceCards resources={message.resources} /> : null}
        {message.memoryIds.length > 0 ? (
          <MemoryProposals agent={memoryAgent} memoryIds={message.memoryIds} />
        ) : null}
        {showSources && message.sources.length > 0 ? (
          <SourcesList conversation={conversation} sources={message.sources} />
        ) : null}
        {isInterrupted ? (
          <p className="text-sm text-muted-foreground">
            <Trans>This reply was interrupted before it finished.</Trans>
          </p>
        ) : null}
        {message.status === "completed" && text !== "" ? (
          // The actions show when the pointer is over the reply or the keyboard is in them, as in
          // the Claude app; a touch screen, with no fine pointer to hover, always shows them.
          <MessageFooter className="px-0 transition-opacity duration-150 pointer-fine:opacity-0 pointer-fine:group-hover/message:opacity-100 pointer-fine:focus-within:opacity-100">
            <CopyButton text={text} />
            {/* A local reply gets its id once the persisted messages replace it. */}
            {message.id.startsWith("local-") ? null : (
              <FeedbackDialog conversation={conversation} agentMessageId={message.id} />
            )}
          </MessageFooter>
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
