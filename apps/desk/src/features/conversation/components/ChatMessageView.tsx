import { useLingui } from "@lingui/react/macro"
import { CopyButton } from "@/components/shared/CopyButton"
import { RelativeTime } from "@/components/shared/RelativeTime"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageContent } from "@/components/ui/message"
import type { ChatMessage } from "../chat-messages"
import type { ConversationRef } from "../conversation-ref"
import type { AppsHtml } from "../mcp-apps"
import { AssistantMessageView } from "./AssistantMessageView"
import { AttachmentChip } from "./AttachmentChip"
import { MessageActions } from "./MessageActions"
import { UserMessageText } from "./UserMessageText"

export type ChatMessageViewProps = {
  conversation: ConversationRef
  message: ChatMessage
  /** Whether the project shows the sources of a reply (its `sources-tool` feature). */
  showSources: boolean
  now: number
  appsHtml: AppsHtml
  onAppMessage: (text: string) => void
}

/** One message: the person's in a bubble on the right, the agent's on the left with its steps. */
export function ChatMessageView({
  conversation,
  message,
  now,
  showSources,
  appsHtml,
  onAppMessage,
}: ChatMessageViewProps) {
  const { t } = useLingui()
  if (message.role === "user") {
    return (
      <Message align="end">
        <MessageContent>
          {message.attachment ? (
            <AttachmentChip conversation={conversation} attachment={message.attachment} />
          ) : null}
          <Bubble align="end" variant="muted">
            <BubbleContent>
              <UserMessageText content={message.content} />
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
      showSources={showSources}
      appsHtml={appsHtml}
      onAppMessage={onAppMessage}
    />
  )
}
