import { useLingui } from "@lingui/react/macro"
import { MessageSquarePlusIcon } from "lucide-react"
import { type KeyboardEvent, type ReactNode, useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { clearQuoteHighlight, showQuoteHighlight } from "@/lib/quote-highlight"
import { readQuotableSelection } from "../annotation"

export type QuoteReplyPopoverProps = {
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
export function QuoteReplyPopover({ onAnnotate, messageBoxId, children }: QuoteReplyPopoverProps) {
  const { t } = useLingui()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [note, setNote] = useState("")

  const close = () => {
    clearQuoteHighlight()
    setQuote(null)
    setNote("")
  }

  const handleMouseUp = () => {
    const selected = readQuotableSelection(window.getSelection())
    if (!selected) return
    showQuoteHighlight(selected.range)
    setQuote(selected)
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
          <div className="flex items-end gap-1">
            <Textarea
              aria-label={t`Your note on this passage`}
              placeholder={t`Annotate`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              rows={2}
              className="max-h-40 min-h-12 resize-none border-0 bg-transparent px-0 py-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t`Add to your message`}
                    onClick={handleAdd}
                  />
                }
              >
                <MessageSquarePlusIcon aria-hidden />
              </TooltipTrigger>
              <TooltipContent>{t`Add to your message`}</TooltipContent>
            </Tooltip>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
