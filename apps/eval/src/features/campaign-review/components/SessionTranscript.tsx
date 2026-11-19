import {
  type ConversationMessageOutputDto,
  type ConversationParamsDto,
  type ReviewerSessionOutputDto,
  TOOL_NAMES,
} from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { ReadOnlyConversation } from "@/features/conversation"

export type SessionTranscriptProps = {
  messages: ReviewerSessionOutputDto["transcript"]
  /** The session as a conversation, which the documents of its sources belong to. */
  conversation: ConversationParamsDto
}

/** A transcript message as the tester's chat holds it: a reply keeps the tools it called. */
function toConversationMessage(
  message: ReviewerSessionOutputDto["transcript"][number],
): ConversationMessageOutputDto {
  // An API that sends no tool calls still sends the sources: the chat reads them as their tool.
  const toolCalls =
    message.toolCalls ??
    (message.sources.length > 0
      ? [
          {
            id: `${message.id}-sources`,
            name: TOOL_NAMES.sources,
            arguments: { sources: message.sources },
          },
        ]
      : [])
  return {
    id: message.id,
    role: message.role === "user" ? "user" : "assistant",
    content: message.content,
    status: "completed",
    createdAt: message.createdAt,
    toolCalls,
  }
}

/**
 * What the tester and the agent said, oldest first, as the tester's chat showed it: the same
 * messages, with the steps, sources and resources of each reply, only to read.
 */
export function SessionTranscript({ messages, conversation }: SessionTranscriptProps) {
  if (messages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        <Trans>This session has no message.</Trans>
      </p>
    )
  }
  return (
    <ReadOnlyConversation
      conversation={conversation}
      messages={messages.map(toConversationMessage)}
    />
  )
}
