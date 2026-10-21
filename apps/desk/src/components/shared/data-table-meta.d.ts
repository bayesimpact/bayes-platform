import "@tanstack/react-table"

declare module "@tanstack/react-table" {
  // The classes a column gives its header and cells in the app's DataTable.
  // biome-ignore lint/correctness/noUnusedVariables: the generics must match TanStack's own.
  interface ColumnMeta<TData extends RowData, TValue> {
    headerClassName?: string
    cellClassName?: string
  }
}
