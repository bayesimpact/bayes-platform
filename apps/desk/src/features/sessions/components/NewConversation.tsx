import { Trans, useLingui } from "@lingui/react/macro"
import { ArrowUpIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export type NewConversationProps = {
  agentName: string
}

/**
 * A new conversation, before its first message: a greeting and the message box, as in the Claude
 * app. Sending comes with the chat, in the next change: the box is shown but disabled.
 */
export function NewConversation({ agentName }: NewConversationProps) {
  const { t } = useLingui()
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 pb-16">
      <h1 className="text-center text-3xl font-semibold tracking-tight">
        <Trans>How can I help you today?</Trans>
      </h1>
      <form className="w-full max-w-2xl" onSubmit={(event) => event.preventDefault()}>
        <div className="flex flex-col gap-2 rounded-2xl border bg-background p-3 shadow-sm">
          <Textarea
            aria-label={t`Message to ${agentName}`}
            placeholder={t`Write to ${agentName}`}
            disabled
            className="min-h-20 resize-none border-0 shadow-none focus-visible:ring-0"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              <Trans>Sending messages comes in the next version of the Desk.</Trans>
            </p>
            <Button type="submit" size="icon" disabled aria-label={t`Send`}>
              <ArrowUpIcon aria-hidden />
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
