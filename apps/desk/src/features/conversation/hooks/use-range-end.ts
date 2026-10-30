import { useLayoutEffect, useState } from "react"
import { measureRangeEnd } from "@/lib/quote-highlight"

/**
 * Where a passage ends in the element its number is drawn in, measured again whenever that
 * element changes size, as when a message arrives or the side panel moves the lines. The layout is
 * outside React, which an effect follows.
 */
export function useRangeEnd(range: Range, layer: HTMLElement) {
  const [end, setEnd] = useState<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    const measure = () => setEnd(measureRangeEnd(range, layer))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(layer)
    return () => observer.disconnect()
  }, [range, layer])
  return end
}
