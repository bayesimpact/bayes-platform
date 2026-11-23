import { type KeyboardEvent, type PointerEvent, useState } from "react"

type UseResizableWidthOptions = {
  /** Where the width is kept on this device, so it survives a reload. */
  storageKey: string
  defaultWidth: number
  minWidth: number
  maxWidth: number
  /** The edge the handle sits on: dragging it outwards widens the element. */
  edge: "left" | "right"
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
}: UseResizableWidthOptions) {
  const [width, setWidth] = useState(() =>
    clamp(readStoredWidth(storageKey) ?? defaultWidth, minWidth, maxWidth),
  )
  const [isResizing, setIsResizing] = useState(false)
  const outwards = edge === "right" ? 1 : -1

  const resizeTo = (next: number) => {
    const clamped = clamp(next, minWidth, maxWidth)
    setWidth(clamped)
    storeWidth(storageKey, clamped)
  }

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    // No text selection while dragging.
    event.preventDefault()
    const startX = event.clientX
    const startWidth = width
    setIsResizing(true)
    // Followed on the window, so a fast drag that leaves the thin edge still resizes.
    const handleMove = (moveEvent: globalThis.PointerEvent) =>
      setWidth(clamp(startWidth + (moveEvent.clientX - startX) * outwards, minWidth, maxWidth))
    const handleUp = (upEvent: globalThis.PointerEvent) => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
      setIsResizing(false)
      resizeTo(startWidth + (upEvent.clientX - startX) * outwards)
    }
    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
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
