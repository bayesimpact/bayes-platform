import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageContent } from "@/components/ui/message"
import type { ChatMessage } from "../chat-messages"
import type { ConversationRef } from "../conversation-ref"
import type { AppsHtml } from "../mcp-apps"
import { AssistantMessageView } from "./AssistantMessageView"
import { AttachmentChip } from "./AttachmentChip"

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
