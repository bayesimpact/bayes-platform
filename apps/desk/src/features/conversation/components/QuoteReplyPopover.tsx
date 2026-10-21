import { Trans, useLingui } from "@lingui/react/macro"
import { MessageSquarePlusIcon } from "lucide-react"
import { type KeyboardEvent, type ReactNode, useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { readQuotableSelection } from "../annotation"

export type QuoteReplyPopoverProps = {
  agentName: string
  /** Adds the passage and the person's note on it to their message. */
  onAnnotate: (passage: string, note: string) => void
  /** The id of the message box, which gets the focus once the box closes. */
  messageBoxId: string
  children: ReactNode
}

type Quote = { text: string; range: Range }

/**
 * Selecting a passage of a reply opens a small box beside it, as in the Claude app: the person
 * writes a note on it, and the passage and the note join their message, which they send later.
 */
export function QuoteReplyPopover({
  agentName,
  onAnnotate,
  messageBoxId,
  children,
}: QuoteReplyPopoverProps) {
  const { t } = useLingui()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [note, setNote] = useState("")

  const close = () => {
    setQuote(null)
    setNote("")
  }

  const handleMouseUp = () => {
    const selected = readQuotableSelection(window.getSelection())
    if (selected) setQuote(selected)
  }

  const handleAdd = () => {
    if (!quote) return
    onAnnotate(quote.text, note)
    window.getSelection()?.removeAllRanges()
    close()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    handleAdd()
  }

  return (
    // The selection ends with the pointer: its end is when the box can open.
    // biome-ignore lint/a11y/noStaticElementInteractions: the replies stay readable without it; it only adds the box.
    <div className="contents" onMouseUp={handleMouseUp}>
      {children}
      <Popover
        open={quote !== null}
        onOpenChange={(open) => (open ? null : close())}
        // Once the box is gone, the person goes on writing where the note now stands.
        onOpenChangeComplete={(open) => {
          if (!open) document.getElementById(messageBoxId)?.focus()
        }}
      >
        <PopoverContent
          // The box stands under the selected passage, which moves with the page.
          anchor={
            quote ? { getBoundingClientRect: () => quote.range.getBoundingClientRect() } : null
          }
          side="bottom"
          align="start"
          className="w-80"
          initialFocus
          finalFocus={false}
        >
          <blockquote className="line-clamp-2 border-l-2 pl-2 text-xs text-muted-foreground">
            {quote?.text}
          </blockquote>
          <div className="flex items-end gap-2">
            <Textarea
              aria-label={t`Your note on this passage`}
              placeholder={t`Reply to ${agentName}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="max-h-32 min-h-9 resize-none py-1.5"
            />
            <Button size="icon-sm" aria-label={t`Add to your message`} onClick={handleAdd}>
              <MessageSquarePlusIcon aria-hidden />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            <Trans>The passage and your note join your message, which you send when ready.</Trans>
          </p>
        </PopoverContent>
      </Popover>
    </div>
  )
}
