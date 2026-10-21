import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@caseai-connect/ui/shad/table"
import { cn } from "@caseai-connect/ui/utils"
import { flexRender, type Table as TanStackTable } from "@tanstack/react-table"
import type { ReactNode } from "react"

/** Layout hints a column passes in `meta`, as `OutputSchemaBuilder` does. */
export type DataTableColumnMeta = {
  /** Classes of the column's header cell, such as `w-10` for a checkbox or an icon column. */
  className?: string
}

/**
 * The shared look of a list table: a rounded border, muted header labels, selected rows
 * highlighted. The caller owns the TanStack table (columns, sorting, selection, pagination).
 * A column narrows its header cell with `meta: { className: "w-10" }`.
 */
export function DataTable<TData>({
  table,
  onRowClick,
  empty,
}: {
  table: TanStackTable<TData>
  onRowClick?: (row: TData) => void
  /** Shown in place of the rows when there are none. */
  empty: ReactNode
}) {
  // The table instance stays the same across renders, so the React Compiler would memoize the
  // row model and show stale rows after a sort, a filter or a selection.
  "use no memo"
  const rows = table.getRowModel().rows
  const columnCount = table.getVisibleLeafColumns().length

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  colSpan={header.colSpan}
                  className={cn(
                    "text-muted-foreground",
                    (header.column.columnDef.meta as DataTableColumnMeta | undefined)?.className,
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount}>{empty}</TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className={cn(onRowClick && "cursor-pointer")}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
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
