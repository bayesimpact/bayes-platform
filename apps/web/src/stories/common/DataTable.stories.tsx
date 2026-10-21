import { Button } from "@caseai-connect/ui/shad/button"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  type ColumnDef,
  getCoreRowModel,
  type RowSelectionState,
  useReactTable,
} from "@tanstack/react-table"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { fn, userEvent, within } from "storybook/test"
import { DataTable } from "@/common/components/data-table/DataTable"
import { DataTableBulkBar } from "@/common/components/data-table/DataTableBulkBar"
import { buildSelectionColumn } from "@/common/components/data-table/selection-column"

type Item = { id: string; title: string; category: string }

const items: Item[] = [
  { id: "1", title: "Getting started", category: "Product" },
  { id: "2", title: "Pricing overview", category: "Pricing" },
  { id: "3", title: "Contact support", category: "Support" },
  { id: "4", title: "Release notes", category: "Product" },
]

const columns: ColumnDef<Item>[] = [
  buildSelectionColumn<Item>({ rowLabel: (item) => `Select ${item.title}` }),
  { id: "title", accessorKey: "title", header: "Title" },
  { id: "category", accessorKey: "category", header: "Category" },
]

/** A selectable table with its bulk bar, as a page composes them. */
function ExampleTable({
  data,
  selectable,
  onRowClick,
}: {
  data: Item[]
  selectable: boolean
  onRowClick?: (item: Item) => void
}) {
  "use no memo"
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const table = useReactTable({
    data,
    columns: selectable ? columns : columns.slice(1),
    state: { rowSelection },
    getRowId: (item) => item.id,
    enableRowSelection: selectable,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
  })
  const selectedCount = Object.keys(rowSelection).length

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      {selectedCount > 0 && (
        <DataTableBulkBar
          label={`${selectedCount} selected`}
          onClearSelection={() => setRowSelection({})}
        >
          <Button variant="outline" size="sm">
            <Trash2Icon />
            Delete
          </Button>
        </DataTableBulkBar>
      )}
      <DataTable
        table={table}
        onRowClick={onRowClick}
        empty={<p className="py-6 text-center text-sm text-muted-foreground">Nothing here yet.</p>}
      />
    </div>
  )
}

const meta = {
  title: "common/DataTable",
  component: ExampleTable,
  parameters: { layout: "padded" },
  args: { data: items, selectable: true, onRowClick: fn() },
} satisfies Meta<typeof ExampleTable>

export default meta
type Story = StoryObj<typeof meta>

/** Rows with a checkbox column; a click on a row opens it. */
export const Selectable: Story = {}

/** Two rows selected: the bulk bar shows above the table. */
export const WithSelection: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("checkbox", { name: "Select Getting started" }))
    await userEvent.click(canvas.getByRole("checkbox", { name: "Select Release notes" }))
  },
}

/** Without selection: no checkbox column. */
export const ReadOnly: Story = {
  args: { selectable: false, onRowClick: undefined },
}

/** No rows: the empty state takes their place. */
export const Empty: Story = {
  args: { data: [] },
}
