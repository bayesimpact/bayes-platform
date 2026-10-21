import { useLayoutEffect, useState } from "react"
import { measureRangeEnd } from "@/lib/quote-highlight"

/**
 * Where a passage ends in the reply it is in, measured again whenever the reply changes size, as
 * when the window or the side panel moves its lines. The layout is outside React, which an effect
 * follows.
 */
export function useRangeEnd(range: Range, container: HTMLElement) {
  const [end, setEnd] = useState<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    const measure = () => setEnd(measureRangeEnd(range, container))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [range, container])
  return end
}
