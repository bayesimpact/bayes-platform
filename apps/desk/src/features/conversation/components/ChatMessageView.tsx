import { Trans } from "@lingui/react/macro"
import { CircleAlertIcon } from "lucide-react"
import { Markdown } from "@/components/shared/Markdown"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageContent, MessageFooter } from "@/components/ui/message"
import { MemoryProposals } from "@/features/memory"
import { type ChatMessage, isWriting } from "../chat-messages"
import type { ConversationRef } from "../conversation-ref"
import { AttachmentChip } from "./AttachmentChip"
import { CopyButton } from "./CopyButton"
import { FeedbackDialog } from "./FeedbackDialog"
import { ResourceCards } from "./ResourceCards"
import { SourcesList } from "./SourcesList"
import { ToolSteps } from "./ToolSteps"

export type ChatMessageViewProps = {
  conversation: ConversationRef
  message: ChatMessage
  /** Whether the project shows the sources of a reply (its `sources-tool` feature). */
  showSources: boolean
  now: number
}

/** One message: the person's in a bubble on the right, the agent's on the left with its steps. */
export function ChatMessageView({ conversation, message, now, showSources }: ChatMessageViewProps) {
  if (message.role === "user") {
    return (
      <Message align="end">
        <MessageContent>
          {message.attachment ? (
            <AttachmentChip conversation={conversation} attachment={message.attachment} />
          ) : null}
          <Bubble align="end" variant="muted">
            <BubbleContent className="whitespace-pre-wrap">{message.content}</BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    )
  }

  const writing = isWriting(message, now)
  const isInterrupted = message.status === "aborted" || (message.status === "streaming" && !writing)
  return (
    <Message>
      <MessageContent className="gap-3">
        <ToolSteps
          toolNames={message.toolNames}
          isWriting={writing}
          hasText={message.content !== ""}
        />
        {message.status === "error" ? <ReplyError message={message} /> : null}
        {message.status !== "error" && message.content !== "" ? (
          <Markdown isStreaming={writing}>{message.content}</Markdown>
        ) : null}
        {message.resources.length > 0 ? <ResourceCards resources={message.resources} /> : null}
        {message.memoryIds.length > 0 ? (
          <MemoryProposals
            agent={{
              organizationId: conversation.organizationId,
              projectId: conversation.projectId,
              agentId: conversation.agentId,
            }}
            memoryIds={message.memoryIds}
          />
        ) : null}
        {showSources && message.sources.length > 0 ? (
          <SourcesList conversation={conversation} sources={message.sources} />
        ) : null}
        {isInterrupted ? (
          <p className="text-sm text-muted-foreground">
            <Trans>This reply was interrupted before it finished.</Trans>
          </p>
        ) : null}
        {message.status === "completed" && message.content !== "" ? (
          <MessageFooter className="px-0">
            <CopyButton text={message.content} />
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

type ReplyErrorProps = {
  message: ChatMessage
}

/** A reply that failed: the server's reason when it gave one, else the Desk's. */
function ReplyError({ message }: ReplyErrorProps) {
  return (
    <div
      role="alert"
      className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"
    >
      <CircleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="flex flex-col gap-1">
        <p className="font-medium">
          <Trans>The agent could not answer.</Trans>
        </p>
        <p className="text-muted-foreground">
          {message.failure === "upload" ? (
            <Trans>The file could not be uploaded. Try again.</Trans>
          ) : message.failure === "ended" ? (
            <Trans>The reply stopped before it finished.</Trans>
          ) : message.failure === "unreachable" ? (
            <Trans>The Desk could not reach the agent. Check your connection.</Trans>
          ) : message.failure === "contract" ? (
            <Trans>A new version of the Desk is available. Reload the page.</Trans>
          ) : (
            message.content
          )}
        </p>
      </div>
    </div>
  )
}
