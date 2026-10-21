import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME_TYPES } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { ArrowUpIcon, FileIcon, PaperclipIcon, XIcon } from "lucide-react"
import { type ChangeEvent, type FormEvent, type KeyboardEvent, useRef, useState } from "react"
import { toast } from "sonner"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import type { OutgoingMessage } from "../chat-messages"

export type ComposerProps = {
  agentName: string
  /** Whether a reply is on its way: the message waits until it ends. */
  isBusy: boolean
  onSend: (message: OutgoingMessage) => void
}

const ACCEPTED_TYPES: readonly string[] = ATTACHMENT_MIME_TYPES

/**
 * The message box, as the shadcn Prompt Input: Enter sends, Shift+Enter starts a new line, and
 * the paperclip attaches a PDF or an image of up to 10 MB.
 */
export function Composer({ agentName, isBusy, onSend }: ComposerProps) {
  const { t } = useLingui()
  const [content, setContent] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canSend = !isBusy && content.trim().length > 0

  const send = () => {
    if (!canSend) return
    onSend({ content: content.trim(), attachment: file ? { file } : null })
    setContent("")
    setFile(null)
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

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null
    // The same file can be picked again after it was removed.
    event.target.value = ""
    if (!picked) return
    if (!ACCEPTED_TYPES.includes(picked.type)) {
      toast.error(t`Attach a PDF, PNG or JPEG file.`)
      return
    }
    if (picked.size > ATTACHMENT_MAX_BYTES) {
      toast.error(t`Attach a file of 10 MB at most.`)
      return
    }
    setFile(picked)
  }

  const fileName = file?.name ?? ""
  return (
    <form className="w-full" onSubmit={handleSubmit}>
      <InputGroup className="rounded-2xl bg-background shadow-sm">
        {file ? (
          <InputGroupAddon align="block-start">
            <span className="flex min-w-0 items-center gap-2 rounded-lg border bg-muted px-2 py-1 text-xs text-foreground">
              <FileIcon aria-hidden className="size-4 shrink-0" />
              <span className="min-w-0 truncate">{file.name}</span>
              <InputGroupButton
                size="icon-xs"
                variant="ghost"
                aria-label={t`Remove ${fileName}`}
                onClick={() => setFile(null)}
              >
                <XIcon aria-hidden />
              </InputGroupButton>
            </span>
          </InputGroupAddon>
        ) : null}
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
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            tabIndex={-1}
            aria-hidden
            onChange={handleFileChange}
          />
          <InputGroupButton
            size="icon-sm"
            variant="outline"
            className="rounded-full"
            aria-label={t`Attach a file`}
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
          >
            <PaperclipIcon aria-hidden />
          </InputGroupButton>
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
