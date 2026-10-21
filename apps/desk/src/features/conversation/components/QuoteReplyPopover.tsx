import { useLingui } from "@lingui/react/macro"
import { MessageSquarePlusIcon, Trash2Icon } from "lucide-react"
import { type KeyboardEvent, type MouseEvent, type ReactNode, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { clearQuoteHighlights, isPointInRange, showQuoteHighlights } from "@/lib/quote-highlight"
import { type Annotation, readQuotableSelection } from "../annotation"
import { AnnotationBadge } from "./AnnotationBadge"

export type QuoteReplyPopoverProps = {
  /** The annotations waiting for the next message, in their order. */
  annotations: Annotation[]
  /** Saves an annotation; one whose note is empty is removed. */
  onSave: (annotation: Annotation) => void
  /** The id of the message box, which gets the focus once the box closes. */
  messageBoxId: string
  children: ReactNode
}

/**
 * Selecting a passage of a reply opens a small box beside it, as in point-by-point: the person
 * writes a note on it, and the passage stays highlighted with its number while they annotate
 * others. Every annotation leaves with their next message; a click on one opens its note again.
 */
export function QuoteReplyPopover({
  annotations,
  onSave,
  messageBoxId,
  children,
}: QuoteReplyPopoverProps) {
  const { t } = useLingui()
  // The annotation whose note is open, new or saved.
  const [editing, setEditing] = useState<Annotation | null>(null)
  const isSaved = editing !== null && annotations.some((saved) => saved.id === editing.id)
  const highlighted = editing && !isSaved ? [...annotations, editing] : annotations

  // The highlights live in the browser, outside React, which these effects follow.
  useEffect(() => {
    showQuoteHighlights(highlighted.map((annotation) => annotation.range))
  }, [highlighted])
  useEffect(() => clearQuoteHighlights, [])

  // Leaving a note keeps it: closing the box, opening another or adding it all save it.
  const open = (annotation: Annotation | null) => {
    if (editing && editing.id !== annotation?.id) onSave(editing)
    setEditing(annotation)
  }

  const handleMouseUp = (event: MouseEvent) => {
    const selected = readQuotableSelection(window.getSelection())
    if (selected) {
      open({
        id: crypto.randomUUID(),
        passage: selected.text,
        note: "",
        range: selected.range,
        layer: selected.layer,
      })
      return
    }
    const clicked = annotations.find((annotation) =>
      isPointInRange(annotation.range, event.clientX, event.clientY),
    )
    if (clicked) open(clicked)
  }

  const hasNote = editing !== null && editing.note.trim() !== ""

  const handleAdd = () => {
    if (!hasNote) return
    window.getSelection()?.removeAllRanges()
    open(null)
  }

  const handleRemove = () => {
    if (editing) onSave({ ...editing, note: "" })
    setEditing(null)
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
      {annotations.map((annotation, index) => (
        <AnnotationBadge
          key={annotation.id}
          annotation={annotation}
          number={index + 1}
          onOpen={() => open(annotation)}
        />
      ))}
      <Popover
        open={editing !== null}
        onOpenChange={(isOpen) => (isOpen ? null : open(null))}
        // Once the box is gone, the person goes on writing their message.
        onOpenChangeComplete={(isOpen) => {
          if (!isOpen) document.getElementById(messageBoxId)?.focus()
        }}
      >
        <PopoverContent
          // The box stands under its passage, which moves with the page.
          anchor={
            editing ? { getBoundingClientRect: () => editing.range.getBoundingClientRect() } : null
          }
          side="bottom"
          align="start"
          className="w-80"
          initialFocus
          finalFocus={false}
        >
          <blockquote className="line-clamp-2 border-l-2 pl-2 text-xs text-muted-foreground">
            {editing?.passage}
          </blockquote>
          <div className="flex items-end gap-1">
            <Textarea
              aria-label={t`Your note on this passage`}
              placeholder={t`Annotate`}
              value={editing?.note ?? ""}
              onChange={(event) =>
                setEditing((current) => (current ? { ...current, note: event.target.value } : null))
              }
              onKeyDown={handleKeyDown}
              autoFocus
              rows={2}
              className="max-h-40 min-h-12 resize-none border-0 bg-transparent px-0 py-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            {isSaved ? (
              <IconAction label={t`Remove this annotation`} onClick={handleRemove}>
                <Trash2Icon aria-hidden />
              </IconAction>
            ) : null}
            <IconAction label={t`Add to your message`} onClick={handleAdd} disabled={!hasNote}>
              <MessageSquarePlusIcon aria-hidden />
            </IconAction>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

type IconActionProps = {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}

/** A button of the box, named by its tooltip. */
function IconAction({ label, onClick, disabled, children }: IconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
