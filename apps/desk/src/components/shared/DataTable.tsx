import {
  flexRender,
  type Header,
  type Row,
  type Table as TanStackTable,
} from "@tanstack/react-table"
import { cn } from "cn"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react"
import type { ReactNode } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type DataTableProps<TData> = {
  table: TanStackTable<TData>
  /** What the table says without rows. */
  empty: ReactNode
  /**
   * Opens a row on a click anywhere on it. The keyboard opens it from a button of its cells, which
   * the columns give it.
   */
  onRowOpen?: (row: Row<TData>) => void
  /** The row whose detail is open, which stays marked. */
  openRowId?: string | null
  /** While another page loads, the rows shown fade a little. */
  isRefreshing?: boolean
}

/**
 * Every data table of the app: TanStack Table's model rendered with the shadcn Table. A sortable
 * column's header is a button that cycles its order, and `aria-sort` tells it.
 */
export function DataTable<TData>({
  table,
  empty,
  onRowOpen,
  openRowId = null,
  isRefreshing = false,
}: DataTableProps<TData>) {
  const rows = table.getRowModel().rows
  const columnCount = table.getVisibleLeafColumns().length

  return (
    <div className="overflow-hidden rounded-2xl border bg-background dark:bg-card">
      <Table className={cn("transition-opacity", isRefreshing && "opacity-60")}>
        <TableHeader className="bg-muted/40">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  colSpan={header.colSpan}
                  aria-sort={ariaSortOf(header)}
                  className={cn("h-9 text-xs", header.column.columnDef.meta?.headerClassName)}
                >
                  {header.isPlaceholder ? null : <HeaderContent header={header} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columnCount} className="h-24 text-center text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={openRowId === row.id ? "selected" : undefined}
                onClick={onRowOpen ? () => onRowOpen(row) : undefined}
                className={cn(onRowOpen && "cursor-pointer")}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn("align-top", cell.column.columnDef.meta?.cellClassName)}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function ariaSortOf<TData>(header: Header<TData, unknown>) {
  if (!header.column.getCanSort()) return undefined
  const sorted = header.column.getIsSorted()
  if (sorted === "asc") return "ascending"
  if (sorted === "desc") return "descending"
  return "none"
}

type HeaderContentProps<TData> = {
  header: Header<TData, unknown>
}

function HeaderContent<TData>({ header }: HeaderContentProps<TData>) {
  const content = flexRender(header.column.columnDef.header, header.getContext())
  if (!header.column.getCanSort()) return content
  const sorted = header.column.getIsSorted()
  const Icon = sorted === "asc" ? ArrowUpIcon : sorted === "desc" ? ArrowDownIcon : ArrowUpDownIcon
  return (
    <button
      type="button"
      onClick={header.column.getToggleSortingHandler()}
      className="-mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {content}
      <Icon aria-hidden className={cn("size-3", sorted === false && "opacity-40")} />
    </button>
  )
}
