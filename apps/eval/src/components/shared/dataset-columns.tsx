import type { AgentParamsDto } from "@bayes-platform/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { Link } from "@tanstack/react-router"
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table"
import type { ReactNode } from "react"
import { TimeAgo } from "@/components/shared/TimeAgo"
import { Count } from "./Count"

/** What the list of datasets shows of a dataset, whatever the type of its agent. */
export type DatasetSummary = {
  id: string
  name: string
  recordCount: number
  updatedAt: number
}

const columnHelper = createColumnHelper<DatasetSummary>()

/** The texts of the headers, which the table translates. */
const datasetColumnLabels = {
  name: msg({
    message: "Dataset's name",
    comment: "The header of the column of the names, in the list of datasets",
  }),
  records: msg({ message: "Records", comment: "How many records a dataset holds" }),
  updated: msg({ message: "Updated", comment: "When a dataset last changed" }),
} satisfies Record<string, MessageDescriptor>

/** The columns of a project's datasets: a name opens its dataset. */
export function datasetColumnsOf({
  agent,
  translate,
  renderActions,
}: {
  agent: AgentParamsDto
  translate: (descriptor: MessageDescriptor) => string
  /** What a row offers: the way to its dataset, and what the person can do with it. */
  renderActions: (dataset: DatasetSummary) => ReactNode
}): ColumnDef<DatasetSummary, unknown>[] {
  // Safe: each helper call types its own value, and the list holds them as columns of any value.
  const columns = [
    columnHelper.accessor("name", {
      header: translate(datasetColumnLabels.name),
      cell: (context) => (
        <Link
          to="/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId"
          params={{ ...agent, datasetId: context.row.original.id }}
          className="font-medium underline-offset-4 hover:underline"
        >
          {context.getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor("recordCount", {
      header: translate(datasetColumnLabels.records),
      cell: (context) => <Count value={context.getValue()} />,
      meta: { headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
    }),
    columnHelper.accessor("updatedAt", {
      header: translate(datasetColumnLabels.updated),
      // How long ago, with the full date and time on hover.
      cell: (context) => <TimeAgo moment={context.getValue()} />,
    }),
  ] as ColumnDef<DatasetSummary, unknown>[]
  columns.push(
    columnHelper.display({
      id: "actions",
      cell: (context) => (
        <div className="flex justify-end">{renderActions(context.row.original)}</div>
      ),
    }),
  )
  return columns
}
