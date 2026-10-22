import { Checkbox } from "@caseai-connect/ui/shad/checkbox"
import type { ColumnDef, Table } from "@tanstack/react-table"
import { useTranslation } from "react-i18next"
import type { DataTableColumnMeta } from "./DataTable"

/**
 * The checkbox column of a selectable `DataTable`. Which rows can be selected is the table's
 * `enableRowSelection`; a row that cannot shows a disabled checkbox.
 */
export function buildSelectionColumn<TData>({
  rowLabel,
}: {
  /** The accessible name of a row's checkbox, such as "Select Jane Doe". */
  rowLabel: (row: TData) => string
}): ColumnDef<TData> {
  return {
    id: "select",
    meta: { className: "w-10" } satisfies DataTableColumnMeta,
    enableSorting: false,
    header: ({ table }) => <SelectAllCheckbox table={table} />,
    cell: ({ row }) => (
      <Checkbox
        aria-label={rowLabel(row.original)}
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onCheckedChange={(value) => row.toggleSelected(value === true)}
        // The row may open something on click: ticking the box must not.
        onClick={(event) => event.stopPropagation()}
      />
    ),
  }
}

function SelectAllCheckbox<TData>({ table }: { table: Table<TData> }) {
  // `table` is the same instance across renders: memoized, the box would miss selection changes.
  "use no memo"
  const { t } = useTranslation()
  return (
    <Checkbox
      aria-label={t("actions:selectAll")}
      checked={
        table.getIsAllRowsSelected()
          ? true
          : table.getIsSomeRowsSelected()
            ? "indeterminate"
            : false
      }
      onCheckedChange={(value) => table.toggleAllRowsSelected(value === true)}
    />
  )
}
