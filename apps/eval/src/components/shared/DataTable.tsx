import { ScrollArea, ScrollBar } from "@caseai-connect/app-ui/components/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@caseai-connect/app-ui/components/table"
import { Trans } from "@lingui/react/macro"
import {
  type Cell,
  flexRender,
  type Header,
  type Row,
  type Table as TanStackTable,
} from "@tanstack/react-table"
import { cn } from "cn"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, MoveHorizontalIcon } from "lucide-react"
import type { ReactNode } from "react"

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
 * Every data table of the app: TanStack Table's model rendered with the shadcn Table. A table
 * wider than its page scrolls sideways, with a bar that shows and a line that says so. A sortable
 * column's header is a button that cycles its order, and `aria-sort` tells it.
 */
export function DataTable<TData>({
  table,
  empty,
  onRowOpen,
  openRowId = null,
  isRefreshing = false,
}: DataTableProps<TData>) {
  // TanStack Table v8 mutates its table in place, which the React Compiler cannot see: memoized,
  // the headers would keep the columns of the first render.
  "use no memo"
  const rows = table.getRowModel().rows
  const columnCount = table.getVisibleLeafColumns().length

  return (
    <div className="group/data-table flex flex-col gap-2">
      {/* Above the table, where the person looks first: shown by the scroll area itself, once
          the table is wider than it. */}
      <p className="hidden items-center gap-1 text-xs text-muted-foreground group-has-[[data-slot=scroll-area][data-has-overflow-x]]/data-table:flex">
        <MoveHorizontalIcon aria-hidden className="size-3.5" />
        <Trans>Scroll sideways to see every column.</Trans>
      </p>
      {/* A table wider than its page scrolls sideways, under a bar that stays in view. The table's
          own frame no longer scrolls: the scroll area does, and leaves room for its bar. */}
      <ScrollArea className="overflow-hidden rounded-lg border bg-background data-has-overflow-x:pb-2.5 dark:bg-card [&_[data-slot=table-container]]:overflow-visible">
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
                      <CellContent cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
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
  // As for a cell below: the header's function is called, not mounted as a component.
  "use no memo"
  const definition = header.column.columnDef.header
  const content =
    typeof definition === "function"
      ? definition(header.getContext())
      : flexRender(definition, header.getContext())
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

type CellContentProps<TData> = {
  cell: Cell<TData, unknown>
}

/**
 * What a cell shows. A table builds its columns at each render, with the handlers of its props,
 * so the function of a cell is a new one each time: mounted as a component, as `flexRender` does,
 * it would be a new component at each render, and what the cell holds would mount again and lose
 * its state, such as a row's open menu while a run under way reads its list again. Called here
 * instead, it returns the same components at the same place, which keep their state.
 */
function CellContent<TData>({ cell }: CellContentProps<TData>) {
  // The cell of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const definition = cell.column.columnDef.cell
  return typeof definition === "function"
    ? definition(cell.getContext())
    : flexRender(definition, cell.getContext())
}
