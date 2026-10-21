import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react"

/**
 * Keeps the page scrolled to the end of the conversation while new text comes in, unless the
 * person scrolled up to read. `endRef` marks the end; `isAtEnd` says whether it is in view.
 */
export function useStickToEnd(contentKey: string): {
  endRef: RefObject<HTMLDivElement | null>
  isAtEnd: boolean
  scrollToEnd: () => void
} {
  const endRef = useRef<HTMLDivElement>(null)
  const [isAtEnd, setIsAtEnd] = useState(true)

  // Watching the end of the page is a subscription to the browser, which an effect is for.
  useEffect(() => {
    const end = endRef.current
    if (!end || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(([entry]) =>
      setIsAtEnd(entry?.isIntersecting ?? true),
    )
    observer.observe(end)
    return () => observer.disconnect()
  }, [])

  // Before paint, so the new text never shows below the fold first.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the content is what moves the end.
  useLayoutEffect(() => {
    if (isAtEnd) endRef.current?.scrollIntoView?.({ block: "end" })
  }, [contentKey, isAtEnd])

  const scrollToEnd = () => endRef.current?.scrollIntoView?.({ block: "end", behavior: "smooth" })
  return { endRef, isAtEnd, scrollToEnd }
}
