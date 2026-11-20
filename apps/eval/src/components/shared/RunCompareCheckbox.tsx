import { useLingui } from "@lingui/react/macro"
import type { Row } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { fullDateTimeOf } from "@/lib/format-time"

export type RunCompareCheckboxProps<TRun extends { createdAt: number }> = {
  /** The row of the run, whose selection picks it for the comparison. */
  row: Row<TRun>
}

/**
 * The box of a run's row that picks it for the comparison, for an agent of any type. It is the
 * cell itself, not what a function of the table's owner returns: the table then keeps it from one
 * render to the next, and the box keeps the focus once checked.
 */
export function RunCompareCheckbox<TRun extends { createdAt: number }>({
  row,
}: RunCompareCheckboxProps<TRun>) {
  // The row of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { t, i18n } = useLingui()
  const started = fullDateTimeOf(row.original.createdAt, i18n.locale)
  return (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={() => row.toggleSelected()}
      aria-label={t`Compare the run of ${started}`}
    />
  )
}
