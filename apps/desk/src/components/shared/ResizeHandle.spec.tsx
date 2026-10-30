import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { useResizableWidth } from "@/hooks/use-resizable-width"
import { ResizeHandle } from "./ResizeHandle"

function ResizableBox() {
  const resizable = useResizableWidth({
    storageKey: "test.width",
    defaultWidth: 256,
    minWidth: 200,
    maxWidth: 300,
    edge: "right",
  })
  return <ResizeHandle edge="right" aria-label="Resize the box" {...resizable.handleProps} />
}

beforeEach(() => {
  window.localStorage.clear()
})

describe("ResizeHandle", () => {
  it("widens its element by a drag, within its bounds, and keeps the width", () => {
    render(<ResizableBox />)
    const handle = screen.getByRole("separator", { name: "Resize the box" })

    fireEvent.pointerDown(handle, { button: 0, clientX: 256 })
    fireEvent.pointerMove(window, { clientX: 280 })
    fireEvent.pointerUp(window, { clientX: 400 })

    expect(handle).toHaveAttribute("aria-valuenow", "300")
    expect(window.localStorage.getItem("test.width")).toBe("300")
  })

  it("moves with the arrow keys, and goes back to its default on a double click", () => {
    render(<ResizableBox />)
    const handle = screen.getByRole("separator", { name: "Resize the box" })

    fireEvent.keyDown(handle, { key: "ArrowLeft" })
    expect(handle).toHaveAttribute("aria-valuenow", "240")

    fireEvent.doubleClick(handle)
    expect(handle).toHaveAttribute("aria-valuenow", "256")
  })
})
