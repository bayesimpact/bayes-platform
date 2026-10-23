import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@caseai-connect/ui/shad/table"
import { cn } from "@caseai-connect/ui/utils"
import {
  type ColumnDef,
  flexRender,
  type Row,
  type Table as TanStackTable,
} from "@tanstack/react-table"
import { type CSSProperties, Fragment, type ReactNode } from "react"

/** Layout hints a column passes in `meta`, as `OutputSchemaBuilder` does. */
export type DataTableColumnMeta = {
  /** Classes of the column's header cell, such as `w-10` for a checkbox or an icon column. */
  className?: string
  /** Classes of the column's body cells, such as `align-top` when rows grow tall. */
  cellClassName?: string
}

/**
 * The shared look of a list table: a rounded border, muted header labels, selected rows
 * highlighted. The caller owns the TanStack table (columns, sorting, selection, pagination).
 * A column narrows its header cell with `meta: { className: "w-10" }`. A column that sets `size`
 * gets that width, and its cells that max width, so long values truncate instead of widening it.
 * An expanded row (`row.getIsExpanded()`) shows `renderExpanded` under it, across all columns.
 */
export function DataTable<TData>({
  table,
  onRowClick,
  renderExpanded,
  empty,
}: {
  table: TanStackTable<TData>
  onRowClick?: (row: TData) => void
  /** What an expanded row shows under it. The table's `getRowCanExpand` says which rows expand. */
  renderExpanded?: (row: Row<TData>) => ReactNode
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
                  style={columnWidth(header.column.columnDef)}
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
              <Fragment key={row.id}>
                <TableRow
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      style={columnWidth(cell.column.columnDef, { capped: true })}
                      className={
                        (cell.column.columnDef.meta as DataTableColumnMeta | undefined)
                          ?.cellClassName
                      }
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
                {renderExpanded && row.getIsExpanded() && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={columnCount} className="max-w-0 p-0">
                      {renderExpanded(row)}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

/** The width a column asked for with `size`. TanStack gives every column a default size, so only an explicit one counts. */
function columnWidth<TData>(
  columnDef: ColumnDef<TData>,
  { capped = false }: { capped?: boolean } = {},
): CSSProperties | undefined {
  if (columnDef.size === undefined) return undefined
  return capped ? { width: columnDef.size, maxWidth: columnDef.size } : { width: columnDef.size }
}
