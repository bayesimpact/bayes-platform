import { type PointerEvent, useEffect, useState } from "react"

/** How long the sidebar stays once the pointer left it, so it can cross to it from the button. */
const HIDE_DELAY_MS = 300

type UseSidebarPeekOptions = {
  /** Whether the sidebar may peek: it is hidden, at a desktop width. */
  canPeek: boolean
}

/**
 * A hidden sidebar that shows while the pointer is on the button that shows it, as in the Claude
 * app. It stays while the pointer is on the button or on the sidebar, and hides a moment after it
 * left both. A mouse only: focus or a touch never peeks, and a click opens the sidebar for good.
 */
export function useSidebarPeek({ canPeek }: UseSidebarPeekOptions) {
  const [isPeekStarted, setIsPeekStarted] = useState(false)
  const [isPointerOver, setIsPointerOver] = useState(false)

  // The timer that hides the sidebar once the pointer left both the button and the sidebar.
  useEffect(() => {
    if (isPointerOver || !isPeekStarted) return
    const timer = window.setTimeout(() => setIsPeekStarted(false), HIDE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [isPointerOver, isPeekStarted])

  const handlePointerLeave = () => setIsPointerOver(false)
  return {
    isPeeking: canPeek && isPeekStarted,
    toggleProps: {
      onPointerEnter: (event: PointerEvent) => {
        if (event.pointerType !== "mouse") return
        setIsPointerOver(true)
        if (canPeek) setIsPeekStarted(true)
      },
      onPointerLeave: handlePointerLeave,
      onClick: () => setIsPeekStarted(false),
    },
    sidebarProps: {
      onPointerEnter: () => setIsPointerOver(true),
      onPointerLeave: handlePointerLeave,
    },
  }
}
