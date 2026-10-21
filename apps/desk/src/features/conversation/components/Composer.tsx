import { Trans, useLingui } from "@lingui/react/macro"
import { ArrowUpIcon } from "lucide-react"
import { type FormEvent, type KeyboardEvent, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export type ComposerProps = {
  agentName: string
  /** Whether a reply is on its way: the message waits until it ends. */
  isBusy: boolean
  onSend: (content: string) => void
}

/** The message box: Enter sends, Shift+Enter starts a new line. */
export function Composer({ agentName, isBusy, onSend }: ComposerProps) {
  const { t } = useLingui()
  const [content, setContent] = useState("")
  const canSend = !isBusy && content.trim().length > 0

  const send = () => {
    if (!canSend) return
    onSend(content.trim())
    setContent("")
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    send()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter while an input method composes a word confirms the word, not the message.
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    send()
  }

  return (
    <form className="w-full" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2 rounded-2xl border bg-background p-3 shadow-sm">
        <Textarea
          aria-label={t`Message to ${agentName}`}
          placeholder={t`Write to ${agentName}`}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className="max-h-60 min-h-12 resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {isBusy ? <Trans>The agent is answering…</Trans> : null}
          </p>
          <Button type="submit" size="icon" disabled={!canSend} aria-label={t`Send`}>
            <ArrowUpIcon aria-hidden />
          </Button>
        </div>
      </div>
    </form>
  )
}
