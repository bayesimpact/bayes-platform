import { getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { renderWithI18n } from "@/test/render-with-i18n"
import { DataTable } from "./DataTable"

const ROWS = [{ id: "first" }]

/** A cell with a state of its own, as a row's menu is open or closed. */
function Counter() {
  const [count, setCount] = useState(0)
  return (
    <button type="button" onClick={() => setCount((current) => current + 1)}>
      Clicked {count}
    </button>
  )
}

function TableRenderedAgain() {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const [renderCount, setRenderCount] = useState(0)
  const table = useReactTable({
    data: ROWS,
    // Built at each render, as the columns of a table that takes its handlers from its props.
    columns: [{ id: "counter", header: () => "Counter", cell: () => <Counter /> }],
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <>
      <button type="button" onClick={() => setRenderCount((current) => current + 1)}>
        Render again ({renderCount})
      </button>
      <DataTable table={table} empty={null} />
    </>
  )
}

describe("DataTable", () => {
  it("keeps the state of a cell when the table renders again with columns built anew", async () => {
    renderWithI18n(<TableRenderedAgain />)

    await userEvent.click(screen.getByRole("button", { name: "Clicked 0" }))
    expect(screen.getByRole("button", { name: "Clicked 1" })).toBeInTheDocument()

    // A run under way reads its list again every few seconds: the table renders again.
    await userEvent.click(screen.getByRole("button", { name: "Render again (0)" }))

    expect(screen.getByRole("button", { name: "Render again (1)" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Clicked 1" })).toBeInTheDocument()
  })
})
