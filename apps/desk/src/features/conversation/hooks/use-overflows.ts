import { type RefObject, useLayoutEffect, useState } from "react"

/**
 * Whether an element's content is taller than the element, measured again whenever either changes
 * size. The layout is outside React, which an effect follows; `isMeasuring` false keeps the last
 * answer, as while the element is let out to its full height.
 */
export function useOverflows(ref: RefObject<HTMLElement | null>, isMeasuring: boolean): boolean {
  const [overflows, setOverflows] = useState(false)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || !isMeasuring) return
    const measure = () => setOverflows(element.scrollHeight > element.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    if (element.firstElementChild) observer.observe(element.firstElementChild)
    return () => observer.disconnect()
  }, [ref, isMeasuring])
  return overflows
}
