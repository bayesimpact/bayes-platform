import { useCallback } from "react"

export function useScrollToEnd<T extends HTMLElement | null>(
  containerRef: React.RefObject<T>,
  behavior: ScrollBehavior = "instant",
) {
  return useCallback(() => {
    if (!containerRef.current) return
    containerRef.current.scrollIntoView({ behavior, block: "end" })
  }, [containerRef, behavior])
}
