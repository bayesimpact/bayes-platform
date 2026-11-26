import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useResizableWidth } from "./use-resizable-width"

/** An element resized by its right edge, which shows its width and whether a drag is under way. */
function Resizable({ onResize }: { onResize?: (nextWidth: number) => void }) {
  const { width, isResizing, handleProps } = useResizableWidth({
    storageKey: "test.width",
    defaultWidth: 300,
    minWidth: 200,
    maxWidth: 600,
    edge: "right",
    onResize,
  })
  // The hook gives the handle its role, its value and its focus; the label is the caller's.
  const labelledHandleProps = { ...handleProps, "aria-label": "Resize" }
  return (
    <div>
      <div {...labelledHandleProps} />
      <p>Width: {width}</p>
      <p>{isResizing ? "Resizing" : "Still"}</p>
    </div>
  )
}

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe("useResizableWidth", () => {
  it("keeps the width a drag reached when the browser cancels it, and follows the pointer no more", () => {
    render(<Resizable />)
    const handle = screen.getByRole("separator", { name: "Resize" })

    fireEvent.pointerDown(handle, { button: 0, clientX: 100 })
    fireEvent.pointerMove(window, { clientX: 150 })
    fireEvent.pointerCancel(window)
    fireEvent.pointerMove(window, { clientX: 250 })

    expect(handle.getAttribute("aria-valuenow")).toBe("350")
    expect(screen.getByText("Width: 350")).toBeTruthy()
    expect(screen.getByText("Still")).toBeTruthy()
    expect(window.localStorage.getItem("test.width")).toBe("350")
  })

  it("follows the pointer no more once the element leaves the page mid-drag", () => {
    const onResize = vi.fn()
    const { unmount } = render(<Resizable onResize={onResize} />)
    fireEvent.pointerDown(screen.getByRole("separator", { name: "Resize" }), {
      button: 0,
      clientX: 100,
    })

    unmount()
    fireEvent.pointerMove(window, { clientX: 150 })
    fireEvent.pointerUp(window, { clientX: 150 })

    expect(onResize).not.toHaveBeenCalled()
    expect(window.localStorage.getItem("test.width")).toBeNull()
  })

  it("tells the width the element is about to take", () => {
    const onResize = vi.fn()
    render(<Resizable onResize={onResize} />)

    fireEvent.keyDown(screen.getByRole("separator", { name: "Resize" }), { key: "ArrowRight" })

    expect(onResize).toHaveBeenCalledWith(316)
  })
})
