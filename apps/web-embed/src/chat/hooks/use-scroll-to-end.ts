import { useCallback } from "react"

export function useScrollToEnd<T extends HTMLElement | null>(
  containerRef: React.RefObject<T>,
  behavior: ScrollBehavior = "instant",
) {
  return useCallback(() => {
    // Defer one animation frame so the browser has painted the new content
    // before we try to scroll to it.
    requestAnimationFrame(() => {
      if (!containerRef.current) return
      containerRef.current.scrollIntoView({ behavior, block: "end" })
    })
  }, [containerRef, behavior])
}
