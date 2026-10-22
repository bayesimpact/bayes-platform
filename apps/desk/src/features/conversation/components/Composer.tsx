import { plural } from "@lingui/core/macro"
import { Trans, useLingui } from "@lingui/react/macro"
import { ArrowUpIcon, FileIcon, PaperclipIcon, XIcon } from "lucide-react"
import { type ChangeEvent, type FormEvent, type KeyboardEvent, useId, useRef } from "react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { KbdGroup } from "@/components/ui/kbd"
import type { OutgoingMessage } from "../chat-messages"
import { useAttachment } from "../hooks/use-attachment"
import { useDictation } from "../hooks/use-dictation"
import { DictationButton } from "./DictationButton"
import { EnterKey } from "./EnterKey"
import { ShiftKey } from "./ShiftKey"

export type ComposerProps = {
  agentName: string
  /** The id of the text field, so the page can put the focus back in it. */
  inputId?: string
  /** The text being written, which an MCP App can also fill in. */
  content: string
  onContentChange: (content: string) => void
  /** Whether a reply is on its way: the message waits until it ends. */
  isBusy: boolean
  /** How many annotations of the replies leave with the message, which can then be empty. */
  annotationCount?: number
  /**
   * Sends the message, which the box clears at once. `restore` puts its text and file back in the
   * box, for a message that could not leave.
   */
  onSend: (message: OutgoingMessage, restore: () => void) => void
}

/**
 * The message box, as the shadcn Prompt Input: Enter sends, Shift+Enter starts a new line, and
 * the paperclip attaches a PDF or an image of up to 10 MB.
 */
export function Composer({
  agentName,
  inputId,
  content,
  onContentChange,
  isBusy,
  annotationCount = 0,
  onSend,
}: ComposerProps) {
  const { t } = useLingui()
  const attachment = useAttachment()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const dictation = useDictation({ content, onContentChange })
  const canSend = !isBusy && (content.trim().length > 0 || annotationCount > 0)

  const handleSend = () => {
    if (!canSend) return
    dictation.stop()
    const { file } = attachment
    const sentContent = content.trim()
    const restore = () => {
      onContentChange(sentContent)
      if (file) attachment.pick(file)
    }
    onSend({ content: sentContent, attachment: file ? { file } : null }, restore)
    onContentChange("")
    attachment.clear()
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    handleSend()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter while an input method composes a word confirms the word, not the message.
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    handleSend()
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null
    // The same file can be picked again after it was removed.
    event.target.value = ""
    if (picked) attachment.pick(picked)
  }

  const fileName = attachment.file?.name ?? ""
  return (
    <form className="w-full" onSubmit={handleSubmit}>
      {/*
        A white card with a soft shadow, as in the Claude app. shadcn's group fades out when it
        holds a disabled control, which the send button is while the box is empty: not here.
      */}
      <InputGroup className="rounded-3xl border-border bg-background shadow-sm transition duration-150 hover:shadow-md has-disabled:bg-background has-disabled:opacity-100 has-[[data-slot=input-group-control]:focus-visible]:border-foreground/25 has-[[data-slot=input-group-control]:focus-visible]:shadow-md has-[[data-slot=input-group-control]:focus-visible]:ring-0 dark:bg-card dark:has-disabled:bg-card">
        {attachment.file ? (
          <InputGroupAddon align="block-start" className="px-3 pt-3">
            <span className="flex min-w-0 items-center gap-2 rounded-lg border bg-muted px-2 py-1 text-xs text-foreground">
              <FileIcon aria-hidden className="size-4 shrink-0" />
              <span className="min-w-0 truncate">{fileName}</span>
              <InputGroupButton
                size="icon-xs"
                variant="ghost"
                aria-label={t`Remove ${fileName}`}
                onClick={attachment.clear}
              >
                <XIcon aria-hidden />
              </InputGroupButton>
            </span>
          </InputGroupAddon>
        ) : null}
        <div className="relative w-full">
          <InputGroupTextarea
            id={inputId}
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
            accept={attachment.accept}
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
          <span className="mr-auto text-xs font-normal text-muted-foreground">
            {isBusy ? <Trans>The agent is answering…</Trans> : null}
          </span>
          {dictation.isSupported ? (
            <DictationButton isListening={dictation.isListening} onToggle={dictation.toggle} />
          ) : null}
          <InputGroupButton
            type="submit"
            size="icon-sm"
            variant="default"
            className="relative size-8 rounded-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
            disabled={!canSend}
            aria-label={
              annotationCount > 0
                ? t({
                    message: plural(annotationCount, {
                      one: "Send with # annotation",
                      other: "Send with # annotations",
                    }),
                  })
                : t`Send`
            }
          >
            <ArrowUpIcon aria-hidden />
            {annotationCount > 0 ? (
              <span
                aria-hidden
                className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-annotation text-xs leading-none font-semibold text-annotation-foreground ring-2 ring-background"
              >
                {annotationCount}
              </span>
            ) : null}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}
