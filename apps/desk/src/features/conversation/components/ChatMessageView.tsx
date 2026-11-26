import { Bubble, BubbleContent } from "@caseai-connect/app-ui/components/bubble"
import { Message, MessageContent } from "@caseai-connect/app-ui/components/message"
import { CopyButton } from "@caseai-connect/app-ui/compositions/CopyButton"
import { RelativeTime } from "@caseai-connect/app-ui/compositions/RelativeTime"
import type {
  AppsHtml,
  ChatMessage,
  CitedPassages,
  OpenedResource,
  TaskChecks,
} from "@caseai-connect/chat"
import type { ConversationParamsDto } from "@caseai-connect/desk-contracts"
import { useLingui } from "@lingui/react/macro"
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
  /** The questions to show as buttons under a reply: only the last reply has some. */
  followUpQuestions: string[]
  /** Sends a suggested question as the person's next message. */
  onFollowUpQuestion: (question: string) => void
  /** Whether the message is only read, as a reviewer reads a tester's session. */
  isReadOnly?: boolean
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
  followUpQuestions,
  onFollowUpQuestion,
  isReadOnly = false,
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
      followUpQuestions={followUpQuestions}
      onFollowUpQuestion={onFollowUpQuestion}
      isReadOnly={isReadOnly}
    />
  )
}
