import { Checkbox } from "@caseai-connect/app-ui/components/checkbox"
import { useLingui } from "@lingui/react/macro"
import type { Table } from "@tanstack/react-table"

export type RunCompareAllCheckboxProps<TRun> = {
  /** The table of runs, whose rows the box picks or lets go together. */
  table: Table<TRun>
}

/**
 * The box at the head of the runs' boxes: it picks every run of the table for the comparison, or
 * lets them all go. It is the header itself, as `RunCompareCheckbox` is the cell.
 */
export function RunCompareAllCheckbox<TRun>({ table }: RunCompareAllCheckboxProps<TRun>) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { t } = useLingui()
  return (
    <Checkbox
      checked={table.getIsAllRowsSelected()}
      indeterminate={table.getIsSomeRowsSelected()}
      onCheckedChange={() => table.toggleAllRowsSelected()}
      aria-label={t`Compare all the runs of the table`}
    />
  )
}
