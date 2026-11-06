import { Trans } from "@lingui/react/macro"
import { CircleAlertIcon } from "lucide-react"
import type { ReactNode } from "react"
import type { ChatMessage, ReplyFailure } from "../chat-messages"

export type ReplyErrorProps = {
  message: ChatMessage
}

/** A reply that failed: the server's reason when it gave one, else the Desk's. */
export function ReplyError({ message }: ReplyErrorProps) {
  const failureReasons: Record<ReplyFailure, ReactNode> = {
    upload: <Trans>The file could not be uploaded. Try again.</Trans>,
    ended: <Trans>The reply stopped before it finished.</Trans>,
    unreachable: <Trans>The Desk could not reach the agent. Check your connection.</Trans>,
    contract: <Trans>A new version of the Desk is available. Reload the page.</Trans>,
  }
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
          {message.failure === null ? message.content : failureReasons[message.failure]}
        </p>
      </div>
    </div>
  )
}
