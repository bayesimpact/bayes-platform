import { useCallback } from "react"

// The nearest ancestor that scrolls its own content, or null.
function scrollableAncestor(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement
  while (node) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === "auto" || overflowY === "scroll") return node
    node = node.parentElement
  }
  return null
}

export function useScrollToEnd<T extends HTMLElement | null>(
  containerRef: React.RefObject<T>,
  behavior: ScrollBehavior = "instant",
) {
  return useCallback(() => {
    // Defer one animation frame so the browser has painted the new content
    // before we try to scroll to it.
    requestAnimationFrame(() => {
      const end = containerRef.current
      if (!end) return
      // Scroll only the chat's own scroller. scrollIntoView would also scroll
      // every ancestor, including the host page when the chat is in an iframe.
      const scroller = scrollableAncestor(end)
      if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior })
    })
  }, [containerRef, behavior])
}
