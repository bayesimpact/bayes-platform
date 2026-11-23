import { useLingui } from "@lingui/react/macro"
import { cn } from "cn"
import { Trash2Icon } from "lucide-react"
import { type KeyboardEvent, type ReactNode, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { clearQuoteHighlights, isPointInRange, showQuoteHighlights } from "@/lib/quote-highlight"
import { type Annotation, isSameRange, readQuotableSelection } from "../annotation"
import { type ReplyClick, useSettledSelection } from "../hooks/use-settled-selection"
import { AnnotationBadge } from "./AnnotationBadge"
import { SelectionActions } from "./SelectionActions"

/** What the box shows: the choice between copying and annotating a passage, or its note. */
type BoxStep = "choose" | "annotate"

export type QuoteReplyPopoverProps = {
  /** The annotations waiting for the next message, in their order. */
  annotations: Annotation[]
  /** Saves an annotation; one whose note is empty is removed. */
  onSave: (annotation: Annotation) => void
  /** The id of the message box, which gets the focus once the box closes. */
  messageBoxId: string
  /** The number of the first annotation, after the passages the conversation's messages quote. */
  firstNumber: number
  /** A click on the text of a reply, off the annotations, as on a passage a message quoted. */
  onReplyClick: (click: ReplyClick) => void
  children: ReactNode
}

/**
 * Selecting a passage of a reply opens a small box beside it, which offers to copy or annotate
 * it. The box leaves the focus and the selection alone, so the browser's own copy works too. To
 * annotate, the person writes a note, as in point-by-point, and the passage stays highlighted with
 * its number while they annotate others. Every annotation leaves with their next message; a click
 * on one opens its note again.
 */
export function QuoteReplyPopover({
  annotations,
  onSave,
  messageBoxId,
  firstNumber,
  onReplyClick,
  children,
}: QuoteReplyPopoverProps) {
  const { t } = useLingui()
  // The annotation whose note is open, new or saved.
  const [editing, setEditing] = useState<Annotation | null>(null)
  // It stays as it was once the box closes, so its closing knows what it showed.
  const [step, setStep] = useState<BoxStep>("annotate")
  const isSaved = editing !== null && annotations.some((saved) => saved.id === editing.id)
  // A passage the person only selected keeps the browser's selection, with no highlight.
  const highlighted =
    editing && !isSaved && step === "annotate" ? [...annotations, editing] : annotations

  // The highlights live in the browser, outside React, which these effects follow.
  useEffect(() => {
    showQuoteHighlights(highlighted.map((annotation) => annotation.range))
  }, [highlighted])
  useEffect(() => clearQuoteHighlights, [])

  // Leaving a note keeps it: closing the box, opening another or pressing Enter all save it.
  const handleOpen = (annotation: Annotation | null, nextStep: BoxStep = "annotate") => {
    if (editing && editing.id !== annotation?.id) onSave(editing)
    setEditing(annotation)
    if (annotation) setStep(nextStep)
  }

  // A passage the person selected offers to copy or annotate it, and a click on an annotated one
  // opens its note.
  useSettledSelection((click) => {
    const selected = readQuotableSelection(document.getSelection())
    if (selected) {
      if (editing && isSameRange(editing.range, selected.range)) return
      handleOpen(
        {
          id: crypto.randomUUID(),
          passage: selected.text,
          note: "",
          range: selected.range,
          layer: selected.layer,
          reply: selected.reply,
          occurrence: selected.occurrence,
        },
        "choose",
      )
      return
    }
    const clicked =
      click && annotations.find((annotation) => isPointInRange(annotation.range, click.x, click.y))
    if (clicked) handleOpen(clicked)
    else if (click) onReplyClick(click)
  })

  const hasNote = editing !== null && editing.note.trim() !== ""

  // Enter keeps the note and closes the box, as leaving it does.
  const handleKeep = () => {
    if (!hasNote) return
    window.getSelection()?.removeAllRanges()
    handleOpen(null)
  }

  const handleRemove = () => {
    if (editing) onSave({ ...editing, note: "" })
    setEditing(null)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    handleKeep()
  }

  return (
    <>
      {children}
      {annotations.map((annotation, index) => {
        const number = firstNumber + index
        return (
          <AnnotationBadge
            key={annotation.id}
            range={annotation.range}
            layer={annotation.layer}
            number={number}
            label={t`Edit annotation ${number}`}
            onOpen={() => handleOpen(annotation)}
          />
        )
      })}
      <Popover
        open={editing !== null}
        onOpenChange={(isOpen) => (isOpen ? null : handleOpen(null))}
        // Once a note is closed, the person goes on writing their message. A closed choice leaves
        // the focus where it is, as the person may be selecting another passage.
        onOpenChangeComplete={(isOpen) => {
          if (!isOpen && step === "annotate") document.getElementById(messageBoxId)?.focus()
        }}
      >
        <PopoverContent
          // The box stands under its passage, which moves with the page.
          anchor={
            editing ? { getBoundingClientRect: () => editing.range.getBoundingClientRect() } : null
          }
          side="bottom"
          align="start"
          className={cn(step === "choose" ? "w-auto p-1" : "w-80")}
          // The choice keeps the focus on the page, so the selection stays and copies as usual.
          initialFocus={step === "annotate"}
          finalFocus={false}
        >
          {/* The step alone picks what the box shows: it stays as it was while the box closes. */}
          {step === "choose" ? (
            <SelectionActions
              passage={editing?.passage ?? ""}
              onAnnotate={() => setStep("annotate")}
            />
          ) : (
            <>
              <blockquote className="line-clamp-2 border-l-2 pl-2 text-xs text-muted-foreground">
                {editing?.passage}
              </blockquote>
              <div className="flex items-end gap-1">
                <Textarea
                  aria-label={t`Your note on this passage`}
                  placeholder={t`Annotate and press Enter to keep it`}
                  value={editing?.note ?? ""}
                  onChange={(event) =>
                    setEditing((current) =>
                      current ? { ...current, note: event.target.value } : null,
                    )
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
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
    </>
  )
}

type IconActionProps = {
  label: string
  onClick: () => void
  children: ReactNode
}

/** A button of the box, named by its tooltip. */
function IconAction({ label, onClick, children }: IconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
