import type { AgentParamsDto } from "@bayes-platform/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/DataTable"
import { DatasetRowActions } from "./DatasetRowActions"
import { type DatasetSummary, datasetColumnsOf } from "./dataset-columns"

export type DatasetsTableProps = {
  agent: AgentParamsDto
  datasets: DatasetSummary[]
  /** Renames a dataset, for who may; none hides the action. */
  onRename: ((dataset: DatasetSummary) => void) | null
  /** Deletes a dataset, for who may; none hides the action. */
  onDelete: ((dataset: DatasetSummary) => void) | null
}

/** The datasets of a project, the last changed first: a name opens its dataset. */
export function DatasetsTable({ agent, datasets, onRename, onDelete }: DatasetsTableProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { i18n } = useLingui()
  const table = useReactTable({
    data: datasets,
    columns: datasetColumnsOf({
      agent,
      translate: (descriptor) => i18n._(descriptor),
      renderActions: (dataset) => (
        <DatasetRowActions
          agent={agent}
          dataset={dataset}
          onRename={onRename ? () => onRename(dataset) : null}
          onDelete={onDelete ? () => onDelete(dataset) : null}
        />
      ),
    }),
    getRowId: (dataset) => dataset.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  return <DataTable table={table} empty={<Trans>No dataset yet.</Trans>} />
}
