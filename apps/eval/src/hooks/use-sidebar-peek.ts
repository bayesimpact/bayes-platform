import { type PointerEvent, useEffect, useRef, useState } from "react"

/** How long the sidebar stays once the pointer left it, so it can cross from the button to it. */
const HIDE_DELAY_IN_MILLISECONDS = 300

/** The pointer handlers of what keeps the peeking sidebar in view: its button and itself. */
export type SidebarPeekHandlers = {
  onPointerEnter: (event: PointerEvent) => void
  onPointerLeave: (event: PointerEvent) => void
}

/**
 * The hidden sidebar shows over the page while the pointer rests on its button or on it, as in
 * Claude Desktop, and hides a moment after the pointer leaves both. A touch never peeks: a tap
 * opens the sidebar as a click does.
 */
export function useSidebarPeek(): {
  isPeeking: boolean
  stopPeeking: () => void
  peekHandlers: SidebarPeekHandlers
} {
  const [isPeeking, setIsPeeking] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = null
  }
  // The timer is outside React: it stops with the frame.
  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    },
    [],
  )
  return {
    isPeeking,
    stopPeeking: () => {
      cancelHide()
      setIsPeeking(false)
    },
    peekHandlers: {
      onPointerEnter: (event) => {
        if (event.pointerType === "touch") return
        cancelHide()
        setIsPeeking(true)
      },
      onPointerLeave: () => {
        cancelHide()
        hideTimer.current = setTimeout(() => setIsPeeking(false), HIDE_DELAY_IN_MILLISECONDS)
      },
    },
  }
}
