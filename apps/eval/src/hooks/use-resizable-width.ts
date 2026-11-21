import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react"

type UseResizableWidthOptions = {
  /** Where the width is kept on this device, so it survives a reload. */
  storageKey: string
  defaultWidth: number
  minWidth: number
  maxWidth: number
  /** The edge the handle sits on: dragging it outwards widens the element. */
  edge: "left" | "right"
  /** Called with the width the element is about to take, each time it takes another one. */
  onResize?: (nextWidth: number) => void
}

/** How far an arrow key moves the edge. */
const KEYBOARD_STEP = 16

function clamp(width: number, minWidth: number, maxWidth: number): number {
  return Math.min(maxWidth, Math.max(minWidth, width))
}

function readStoredWidth(storageKey: string): number | null {
  try {
    const stored = Number(window.localStorage.getItem(storageKey))
    return Number.isFinite(stored) && stored > 0 ? stored : null
  } catch {
    // Storage can be blocked: the element then opens at its default width.
    return null
  }
}

function storeWidth(storageKey: string, width: number): void {
  try {
    window.localStorage.setItem(storageKey, String(width))
  } catch {
    // Storage can be blocked: the width then lasts until the next reload.
  }
}

/**
 * The width of an element the person resizes by dragging its edge, or with the arrow keys once
 * the edge has the focus; a double click puts the default back. The width is kept on this device.
 */
export function useResizableWidth({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  edge,
  onResize,
}: UseResizableWidthOptions) {
  const [width, setWidth] = useState(() =>
    clamp(readStoredWidth(storageKey) ?? defaultWidth, minWidth, maxWidth),
  )
  const [isResizing, setIsResizing] = useState(false)
  const outwards = edge === "right" ? 1 : -1

  /** Ends the drag under way, if any: the window no longer follows the pointer. */
  const stopDragRef = useRef<(() => void) | null>(null)
  // The drag follows the pointer on the window, outside React: an element that leaves the page
  // mid-drag stops following it.
  useEffect(() => () => stopDragRef.current?.(), [])

  const resizeTo = (next: number) => {
    const clamped = clamp(next, minWidth, maxWidth)
    onResize?.(clamped)
    setWidth(clamped)
    storeWidth(storageKey, clamped)
  }

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    // No text selection while dragging.
    event.preventDefault()
    stopDragRef.current?.()
    const startX = event.clientX
    const startWidth = width
    const widthAt = (clientX: number) => startWidth + (clientX - startX) * outwards
    /** The width the drag reached, which a cancelled drag keeps. */
    let reachedWidth = startWidth
    setIsResizing(true)
    // Followed on the window, so a fast drag that leaves the thin edge still resizes.
    const handleMove = (moveEvent: globalThis.PointerEvent) => {
      reachedWidth = clamp(widthAt(moveEvent.clientX), minWidth, maxWidth)
      onResize?.(reachedWidth)
      setWidth(reachedWidth)
    }
    const stopDrag = () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
      window.removeEventListener("pointercancel", handleCancel)
      stopDragRef.current = null
      setIsResizing(false)
    }
    const handleUp = (upEvent: globalThis.PointerEvent) => {
      stopDrag()
      resizeTo(widthAt(upEvent.clientX))
    }
    // A drag the browser takes back, for a scroll or a gesture, keeps the width it reached.
    const handleCancel = () => {
      stopDrag()
      resizeTo(reachedWidth)
    }
    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    window.addEventListener("pointercancel", handleCancel)
    stopDragRef.current = stopDrag
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
    event.preventDefault()
    const towardsRight = event.key === "ArrowRight" ? 1 : -1
    resizeTo(width + KEYBOARD_STEP * towardsRight * outwards)
  }

  return {
    width,
    isResizing,
    handleProps: {
      role: "separator",
      "aria-orientation": "vertical",
      "aria-valuenow": width,
      "aria-valuemin": minWidth,
      "aria-valuemax": maxWidth,
      tabIndex: 0,
      onPointerDown: handlePointerDown,
      onKeyDown: handleKeyDown,
      onDoubleClick: () => resizeTo(defaultWidth),
    },
  } as const
}
