import { useEffect, useEffectEvent } from "react"
import { QUOTABLE_ATTRIBUTE } from "../annotation"

/** How long a selection made without the mouse, with the keyboard or a finger, rests first. */
const SELECTION_SETTLE_IN_MILLISECONDS = 400

/** Where a click on the text of a reply landed, on the screen. */
export type ReplyClick = { x: number; y: number }

/**
 * Calls `onSettle` once the person settled a selection or clicked: when the mouse button comes
 * up, or when a selection made with the keyboard or a finger's handles rests a moment, so the box
 * it opens does not take the focus while they still select. A click on the text of a reply comes
 * with its point. The selection lives in the browser, outside React, which an effect follows.
 */
export function useSettledSelection(onSettle: (click: ReplyClick | null) => void) {
  const handleSettle = useEffectEvent((click: ReplyClick | null) => onSettle(click))

  useEffect(() => {
    let isMouseDown = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const handleMouseDown = () => {
      isMouseDown = true
      clearTimeout(timer)
    }
    const handleMouseUp = (event: MouseEvent) => {
      isMouseDown = false
      clearTimeout(timer)
      // A click counts on the text of a reply only: neither on a badge nor in the box.
      const isOnReply =
        event.target instanceof Element && event.target.closest(`[${QUOTABLE_ATTRIBUTE}]`) !== null
      handleSettle(isOnReply ? { x: event.clientX, y: event.clientY } : null)
    }
    // While the mouse selects, the selection is not settled: its button coming up settles it.
    const handleSelectionChange = () => {
      if (isMouseDown) return
      clearTimeout(timer)
      timer = setTimeout(() => handleSettle(null), SELECTION_SETTLE_IN_MILLISECONDS)
    }

    document.addEventListener("mousedown", handleMouseDown)
    document.addEventListener("mouseup", handleMouseUp)
    document.addEventListener("selectionchange", handleSelectionChange)
    return () => {
      document.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("selectionchange", handleSelectionChange)
      clearTimeout(timer)
    }
  }, [])
}
