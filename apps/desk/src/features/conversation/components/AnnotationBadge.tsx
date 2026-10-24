import { useLingui } from "@lingui/react/macro"
import { createPortal } from "react-dom"
import type { Annotation } from "../annotation"
import { useRangeEnd } from "../hooks/use-range-end"

export type AnnotationBadgeProps = {
  annotation: Annotation
  /** Its place among the annotations of the next message, from 1. */
  number: number
  onOpen: () => void
}

/**
 * The number of an annotation, in a small bubble at the end of its passage: it scrolls with the
 * conversation, and opens the note again.
 */
export function AnnotationBadge({ annotation, number, onOpen }: AnnotationBadgeProps) {
  const { t } = useLingui()
  const end = useRangeEnd(annotation.range, annotation.layer)
  if (!end) return null
  return createPortal(
    <button
      type="button"
      aria-label={t`Edit annotation ${number}`}
      onClick={onOpen}
      className="absolute z-10 flex size-4 -translate-y-3/4 items-center justify-center rounded-full bg-annotation text-xs leading-none font-semibold text-annotation-foreground shadow-sm transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      // Raised just after the passage's end, as an exponent, so it covers no word.
      // Safe: where the passage ends is measured on the page, which no class can hold.
      style={{ left: end.left + 1, top: end.top }}
    >
      {number}
    </button>,
    annotation.layer,
  )
}
