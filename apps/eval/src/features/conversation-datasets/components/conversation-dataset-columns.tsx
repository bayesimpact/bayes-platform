import type { AgentParamsDto, ConversationDatasetOutputDto } from "@caseai-connect/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { Link } from "@tanstack/react-router"
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table"
import type { ReactNode } from "react"
import { fullDateTimeOf } from "@/lib/format-time"

const columnHelper = createColumnHelper<ConversationDatasetOutputDto>()

/** The texts of the headers, which the table translates. */
const datasetColumnLabels = {
  name: msg({
    message: "Dataset's name",
    comment: "The header of the column of the names, in the list of datasets",
  }),
  records: msg({ message: "Records", comment: "How many records a dataset holds" }),
  updated: msg({ message: "Updated", comment: "When a dataset last changed" }),
} satisfies Record<string, MessageDescriptor>

/** The columns of a project's conversation datasets: a name opens its dataset. */
export function conversationDatasetColumnsOf({
  agent,
  locale,
  translate,
  renderActions,
}: {
  agent: AgentParamsDto
  locale: string
  translate: (descriptor: MessageDescriptor) => string
  /** What a row offers: the way to its dataset, and what the person can do with it. */
  renderActions: (dataset: ConversationDatasetOutputDto) => ReactNode
}): ColumnDef<ConversationDatasetOutputDto, unknown>[] {
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
      meta: { headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
    }),
    columnHelper.accessor("updatedAt", {
      header: translate(datasetColumnLabels.updated),
      cell: (context) => (
        <span className="text-muted-foreground">{fullDateTimeOf(context.getValue(), locale)}</span>
      ),
    }),
  ] as ColumnDef<ConversationDatasetOutputDto, unknown>[]
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
