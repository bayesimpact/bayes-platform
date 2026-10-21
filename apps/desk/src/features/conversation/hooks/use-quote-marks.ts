import { useLayoutEffect, useState } from "react"
import { measureQuoteMarks, type QuoteMark } from "@/lib/quote-marks"

/**
 * The strokes of a quoted passage, measured again whenever the reply changes size, as when the
 * window or the side panel moves its lines. The layout is outside React, which an effect follows.
 */
export function useQuoteMarks(range: Range, container: HTMLElement): QuoteMark[] {
  const [marks, setMarks] = useState<QuoteMark[]>([])
  useLayoutEffect(() => {
    const measure = () => setMarks(measureQuoteMarks(range, container))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [range, container])
  return marks
}
