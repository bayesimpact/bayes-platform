import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ResizeHandle } from "@/components/shared/ResizeHandle"
import { useResizableWidth } from "./use-resizable-width"

/** An element resized by its right edge, which shows whether a drag is under way. */
function Resizable() {
  const { isResizing, handleProps } = useResizableWidth({
    storageKey: "test.width",
    defaultWidth: 300,
    minWidth: 200,
    maxWidth: 600,
    edge: "right",
  })
  return (
    <div>
      <ResizeHandle edge="right" aria-label="Resize" {...handleProps} />
      <p>{isResizing ? "Resizing" : "Still"}</p>
    </div>
  )
}

describe("useResizableWidth", () => {
  it("keeps the width a drag reached when the browser cancels it, and follows the pointer no more", () => {
    render(<Resizable />)
    const handle = screen.getByRole("separator", { name: "Resize" })

    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 100,
    })
    fireEvent.pointerMove(window, { clientX: 150 })
    fireEvent.pointerCancel(window)
    fireEvent.pointerMove(window, { clientX: 250 })

    expect(handle).toHaveAttribute("aria-valuenow", "350")
    expect(screen.getByText("Still")).toBeInTheDocument()
    expect(window.localStorage.getItem("test.width")).toBe("350")
  })

  it("follows the pointer no more once the element leaves the page mid-drag", () => {
    const { unmount } = render(<Resizable />)
    fireEvent.pointerDown(screen.getByRole("separator", { name: "Resize" }), {
      button: 0,
      clientX: 100,
    })

    unmount()
    fireEvent.pointerMove(window, { clientX: 150 })
    fireEvent.pointerUp(window, { clientX: 150 })

    expect(window.localStorage.getItem("test.width")).toBeNull()
  })
})
