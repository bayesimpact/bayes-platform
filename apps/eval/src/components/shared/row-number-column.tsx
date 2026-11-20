import type { ColumnDef } from "@tanstack/react-table"
import { Count } from "./Count"

/**
 * The first column of a table of records: the number of each row, counted from `firstNumber`, the
 * number of the first row of the page shown.
 */
export function rowNumberColumnOf<TData>(firstNumber = 1): ColumnDef<TData, unknown> {
  return {
    id: "rowNumber",
    header: "#",
    enableSorting: false,
    cell: (context) => (
      <span className="font-mono text-xs text-muted-foreground tabular-nums">
        <Count value={firstNumber + context.row.index} />
      </span>
    ),
  }
}
