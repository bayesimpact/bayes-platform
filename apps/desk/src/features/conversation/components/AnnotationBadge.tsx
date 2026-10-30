import { createPortal } from "react-dom"
import { useRangeEnd } from "../hooks/use-range-end"

export type AnnotationBadgeProps = {
  /** The passage, at whose end the bubble stands. */
  range: Range
  /** The element the bubble is drawn in, which scrolls with the passage. */
  layer: HTMLElement
  /** Its number in the conversation, from 1. */
  number: number
  /** What the bubble does, as a screen reader names it. */
  label: string
  onOpen: () => void
}

/**
 * The number of an annotation, in a small bubble at the end of its passage: it scrolls with the
 * conversation, and opens the note again while it waits, or jumps to the message that sent it.
 */
export function AnnotationBadge({ range, layer, number, label, onOpen }: AnnotationBadgeProps) {
  const end = useRangeEnd(range, layer)
  if (!end) return null
  return createPortal(
    <button
      type="button"
      aria-label={label}
      onClick={onOpen}
      className="absolute z-10 flex h-4 min-w-4 -translate-y-3/4 px-1 items-center justify-center rounded-full bg-annotation text-xs leading-none font-semibold text-annotation-foreground shadow-sm transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      // Raised just after the passage's end, as an exponent, so it covers no word. A number of
      // two digits widens the round bubble into a pill.
      // Safe: where the passage ends is measured on the page, which no class can hold.
      style={{ left: end.left + 1, top: end.top }}
    >
      {number}
    </button>,
    layer,
  )
}
