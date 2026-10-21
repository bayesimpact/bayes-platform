import { createPortal } from "react-dom"
import { useQuoteMarks } from "../hooks/use-quote-marks"

export type QuoteMarkerProps = {
  range: Range
  /** The reply the passage is in, which the strokes scroll with. */
  container: HTMLElement
}

/**
 * A highlighter stroke under a quoted passage, as point-by-point draws it, while the person writes
 * their note on it: drawn under the words rather than around them, so the reply keeps its text.
 */
export function QuoteMarker({ range, container }: QuoteMarkerProps) {
  const marks = useQuoteMarks(range, container)
  return createPortal(
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {marks.map((mark) => (
        <span
          key={`${mark.left}:${mark.top}`}
          className="quote-mark absolute"
          // Safe: the geometry of a stroke is measured on the page, which no class can hold.
          style={{ left: mark.left, top: mark.top, width: mark.width, height: mark.height }}
        />
      ))}
    </div>,
    container,
  )
}
