import { Trans } from "@lingui/react/macro"
import { CircleAlertIcon } from "lucide-react"
import { type ChatMessage, isWriting } from "../chat-messages"
import { CopyButton } from "./CopyButton"
import { ToolSteps } from "./ToolSteps"

export type ChatMessageViewProps = {
  message: ChatMessage
  now: number
}

/** One message: the person's on the right, the agent's on the left with its steps. */
export function ChatMessageView({ message, now }: ChatMessageViewProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl bg-muted px-4 py-2 whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
    )
  }

  const writing = isWriting(message, now)
  const isInterrupted = message.status === "aborted" || (message.status === "streaming" && !writing)
  return (
    <article className="flex flex-col gap-2">
      <ToolSteps toolNames={message.toolNames} isWriting={writing} />
      {writing && message.content === "" ? <ThinkingDots /> : null}
      {message.status === "error" ? <ReplyError message={message} /> : null}
      {message.status !== "error" && message.content !== "" ? (
        // The reply is plain text until the Desk renders Markdown.
        <div className="leading-relaxed whitespace-pre-wrap">{message.content}</div>
      ) : null}
      {isInterrupted ? (
        <p className="text-sm text-muted-foreground">
          <Trans>This reply was interrupted before it finished.</Trans>
        </p>
      ) : null}
      {message.status === "completed" && message.content !== "" ? (
        <div className="-ml-2 flex">
          <CopyButton text={message.content} />
        </div>
      ) : null}
    </article>
  )
}

function ThinkingDots() {
  return (
    <p className="text-sm text-muted-foreground" aria-live="polite">
      <span className="animate-pulse">
        <Trans>Thinking…</Trans>
      </span>
    </p>
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
          {message.failure === "ended" ? (
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
