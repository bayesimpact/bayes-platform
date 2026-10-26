import type { ConversationParamsDto } from "@caseai-connect/desk-contracts"
import { useLingui } from "@lingui/react/macro"
import { CopyButton } from "@/components/shared/CopyButton"
import { RelativeTime } from "@/components/shared/RelativeTime"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageContent } from "@/components/ui/message"
import type { ChatMessage } from "../chat-messages"
import type { CitedPassages } from "../hooks/use-cited-passages"
import type { TaskChecks } from "../hooks/use-task-checks"
import type { AppsHtml } from "../mcp-apps"
import type { OpenedResource } from "../resource-media"
import { AssistantMessageView } from "./AssistantMessageView"
import { AttachmentChip } from "./AttachmentChip"
import { MessageActions } from "./MessageActions"
import { UserMessageText } from "./UserMessageText"

export type ChatMessageViewProps = {
  conversation: ConversationParamsDto
  message: ChatMessage
  /** Whether the project shows the sources of a reply (its `sources-tool` feature). */
  hasSourcesTool: boolean
  now: number
  appsHtml: AppsHtml
  onAppMessage: (text: string) => void
  /** Opens a resource a reply points to beside the conversation. */
  onOpenResource: (resource: OpenedResource) => void
  /** The passages the person's messages quote, which their chips jump to. */
  citedPassages: CitedPassages
  /** The tasks of the replies, as the person left them, and their ticks. */
  taskChecks: TaskChecks
}

/** One message: the person's in a bubble on the right, the agent's on the left with its steps. */
export function ChatMessageView({
  conversation,
  message,
  now,
  hasSourcesTool,
  appsHtml,
  onAppMessage,
  onOpenResource,
  citedPassages,
  taskChecks,
}: ChatMessageViewProps) {
  const { t } = useLingui()
  if (message.role === "user") {
    return (
      <Message align="end">
        <MessageContent className="gap-1">
          {message.attachment ? (
            <AttachmentChip conversation={conversation} attachment={message.attachment} />
          ) : null}
          <Bubble align="end" variant="muted">
            <BubbleContent>
              <UserMessageText
                messageId={message.id}
                content={message.content}
                citedPassages={citedPassages}
              />
            </BubbleContent>
          </Bubble>
          <MessageActions>
            {message.createdAt !== null ? (
              <RelativeTime
                moment={message.createdAt}
                now={now}
                className="px-1 text-xs font-normal"
              />
            ) : null}
            <CopyButton text={message.content} label={t`Copy the message`} />
          </MessageActions>
        </MessageContent>
      </Message>
    )
  }

  return (
    <AssistantMessageView
      conversation={conversation}
      message={message}
      now={now}
      hasSourcesTool={hasSourcesTool}
      appsHtml={appsHtml}
      onAppMessage={onAppMessage}
      onOpenResource={onOpenResource}
      taskChecks={taskChecks}
    />
  )
}
