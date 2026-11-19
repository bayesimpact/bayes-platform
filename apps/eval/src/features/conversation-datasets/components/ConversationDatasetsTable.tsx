import type { AgentParamsDto, ConversationDatasetOutputDto } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/DataTable"
import { conversationDatasetColumnsOf } from "./conversation-dataset-columns"
import { DatasetRowActions } from "./DatasetRowActions"

export type ConversationDatasetsTableProps = {
  agent: AgentParamsDto
  datasets: ConversationDatasetOutputDto[]
  /** Renames a dataset, for who may; none hides the action. */
  onRename: ((dataset: ConversationDatasetOutputDto) => void) | null
  /** Deletes a dataset, for who may; none hides the action. */
  onDelete: ((dataset: ConversationDatasetOutputDto) => void) | null
}

/** The conversation datasets of a project, the last changed first: a name opens its dataset. */
export function ConversationDatasetsTable({
  agent,
  datasets,
  onRename,
  onDelete,
}: ConversationDatasetsTableProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { i18n } = useLingui()
  const table = useReactTable({
    data: datasets,
    columns: conversationDatasetColumnsOf({
      agent,
      locale: i18n.locale,
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
