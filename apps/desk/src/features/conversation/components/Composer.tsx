import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME_TYPES } from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import {
  ArrowBigUpIcon,
  ArrowUpIcon,
  CornerDownLeftIcon,
  FileIcon,
  PaperclipIcon,
  XIcon,
} from "lucide-react"
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useId,
  useRef,
  useState,
} from "react"
import { toast } from "sonner"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import type { OutgoingMessage } from "../chat-messages"

export type ComposerProps = {
  agentName: string
  /** The text being written, which an MCP App can also fill in. */
  content: string
  onContentChange: (content: string) => void
  /** Whether a reply is on its way: the message waits until it ends. */
  isBusy: boolean
  onSend: (message: OutgoingMessage) => void
}

const ACCEPTED_TYPES: readonly string[] = ATTACHMENT_MIME_TYPES

/**
 * The message box, as the shadcn Prompt Input: Enter sends, Shift+Enter starts a new line, and
 * the paperclip attaches a PDF or an image of up to 10 MB.
 */
export function Composer({ agentName, content, onContentChange, isBusy, onSend }: ComposerProps) {
  const { t } = useLingui()
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const canSend = !isBusy && content.trim().length > 0

  const send = () => {
    if (!canSend) return
    onSend({ content: content.trim(), attachment: file ? { file } : null })
    onContentChange("")
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
      {/*
        A white card with a soft shadow, as in the Claude app. shadcn's group fades out when it
        holds a disabled control, which the send button is while the box is empty: not here.
      */}
      <InputGroup className="rounded-3xl border-border bg-background shadow-sm transition-[border-color,box-shadow] duration-150 hover:shadow-md has-disabled:bg-background has-disabled:opacity-100 has-[[data-slot=input-group-control]:focus-visible]:border-foreground/25 has-[[data-slot=input-group-control]:focus-visible]:shadow-md has-[[data-slot=input-group-control]:focus-visible]:ring-0 dark:bg-card dark:has-disabled:bg-card">
        {file ? (
          <InputGroupAddon align="block-start" className="px-3 pt-3">
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
        <div className="relative w-full">
          <InputGroupTextarea
            aria-label={t`Message to ${agentName}`}
            aria-describedby={hintId}
            value={content}
            onChange={(event) => onContentChange(event.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="max-h-60 min-h-14 px-4 pt-4 pb-2 text-base leading-relaxed md:text-base"
          />
          {/*
            The keys to send and to start a line, drawn as keys where a placeholder would stand:
            a placeholder holds plain text only. The field reads them as its description.
          */}
          <p
            id={hintId}
            className={
              content === ""
                ? "pointer-events-none absolute top-4 left-4 flex flex-wrap items-center gap-1 text-base text-muted-foreground"
                : "sr-only"
            }
          >
            <Trans>
              <EnterKey className="ml-0.5" /> to send
            </Trans>
            <span aria-hidden className="px-1">
              ·
            </span>
            <Trans>
              <KbdGroup>
                <ShiftKey />
                <EnterKey />
              </KbdGroup>{" "}
              for a new line
            </Trans>
          </p>
        </div>
        <InputGroupAddon align="block-end" className="px-3 pb-3">
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
            variant="ghost"
            className="rounded-full text-muted-foreground hover:text-foreground"
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
            className="ml-auto size-8 rounded-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
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

type KeyProps = {
  className?: string
}

/** The Enter key, drawn as ↵, and named for screen readers. */
function EnterKey({ className }: KeyProps) {
  const { t } = useLingui()
  return (
    <Kbd className={className}>
      <CornerDownLeftIcon aria-hidden />
      <span className="sr-only">{t({ message: "Enter", comment: "The keyboard key" })}</span>
    </Kbd>
  )
}

/** The Shift key, drawn as ⇧, and named for screen readers. */
function ShiftKey() {
  const { t } = useLingui()
  return (
    <Kbd>
      <ArrowBigUpIcon aria-hidden />
      <span className="sr-only">{t({ message: "Shift", comment: "The keyboard key" })}</span>
    </Kbd>
  )
}
