import { Trans, useLingui } from "@lingui/react/macro"
import { ArrowUpIcon } from "lucide-react"
import { type FormEvent, type KeyboardEvent, useState } from "react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"

export type ComposerProps = {
  agentName: string
  /** Whether a reply is on its way: the message waits until it ends. */
  isBusy: boolean
  onSend: (content: string) => void
}

/** The message box, as the shadcn Prompt Input: Enter sends, Shift+Enter starts a new line. */
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
      <InputGroup className="rounded-2xl bg-background shadow-sm">
        <InputGroupTextarea
          aria-label={t`Message to ${agentName}`}
          placeholder={t`Write to ${agentName}`}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className="max-h-60 min-h-16 p-3"
        />
        <InputGroupAddon align="block-end">
          <span className="text-xs font-normal text-muted-foreground">
            {isBusy ? <Trans>The agent is answering…</Trans> : null}
          </span>
          <InputGroupButton
            type="submit"
            size="icon-sm"
            variant="default"
            className="ml-auto rounded-full"
            disabled={!canSend}
            aria-label={t`Send`}
          >
            <ArrowUpIcon aria-hidden />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}
