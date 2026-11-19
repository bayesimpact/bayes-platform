import type {
  ConversationParamsDto,
  ReviewerSessionOutputDto,
} from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { cn } from "cn"
import { Markdown } from "@/components/shared/Markdown"
import { SourcesList } from "@/features/conversation"

export type SessionTranscriptProps = {
  messages: ReviewerSessionOutputDto["transcript"]
  /** The session as a conversation, which the documents of its sources belong to. */
  conversation: ConversationParamsDto
}

/**
 * What the tester and the agent said, oldest first: the agent's replies render their Markdown and
 * the sources they relied on, as the Desk shows them.
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
    <ol className="flex flex-col gap-3">
      {messages.map((message) => {
        const isTester = message.role === "user"
        return (
          <li
            key={message.id}
            className={cn(
              "flex max-w-full flex-col gap-1 rounded-xl border p-3",
              isTester ? "ml-8 bg-muted/60" : "mr-8",
            )}
          >
            <span className="text-xs font-medium text-muted-foreground">
              {isTester ? (
                <Trans comment="Names who wrote a message of a transcript: the tester">
                  Tester
                </Trans>
              ) : (
                <Trans comment="Names who wrote a message of a transcript: the agent">
                  Assistant
                </Trans>
              )}
            </span>
            {isTester ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <>
                <Markdown>{message.content}</Markdown>
                {message.sources.length > 0 ? (
                  <SourcesList conversation={conversation} sources={message.sources} />
                ) : null}
              </>
            )}
          </li>
        )
      })}
    </ol>
  )
}
