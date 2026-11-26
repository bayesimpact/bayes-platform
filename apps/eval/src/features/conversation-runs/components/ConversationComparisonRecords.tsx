import { Badge } from "@caseai-connect/app-ui/components/badge"
import type { AgentParamsDto, ConversationRunOutputDto } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { cn } from "cn"
import { ComparedRunHead } from "@/components/shared/ComparedRunHead"
import { DataTable } from "@/components/shared/DataTable"
import { rowNumberColumnOf } from "@/components/shared/row-number-column"
import { CELL_TEXT_CLASSES } from "@/lib/cell-text"
import { SUCCESS_BADGE_CLASSES } from "@/lib/success-classes"
import type { ConversationComparisonRow } from "../comparison"
import { scoreOf } from "../score"

export type ConversationComparisonRecordsProps = {
  agentParams: AgentParamsDto
  datasetId: string
  /** The runs compared, in the order the person picked them: a column each. */
  runs: ConversationRunOutputDto[]
  /** A row per record of the dataset: the same list while the runs hold the same records. */
  rows: ConversationComparisonRow[]
}

/**
 * The records of the runs compared, one row each: what the record asks, then the score each run
 * got on it, the best one in green.
 */
export function ConversationComparisonRecords({
  agentParams,
  datasetId,
  runs,
  rows,
}: ConversationComparisonRecordsProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { i18n } = useLingui()
  const columns: ColumnDef<ConversationComparisonRow>[] = [
    rowNumberColumnOf<ConversationComparisonRow>(),
    {
      id: "input",
      header: () => <Trans comment="What an evaluation sends to the agent">Input</Trans>,
      cell: ({ row }) => (
        <p title={row.original.input} className={cn(CELL_TEXT_CLASSES, "max-w-80")}>
          {row.original.input}
        </p>
      ),
    },
    {
      id: "expectedOutput",
      header: () => (
        <Trans comment="The answer an evaluation expects from the agent">Expected output</Trans>
      ),
      cell: ({ row }) => (
        <p className={cn(CELL_TEXT_CLASSES, "max-w-80 text-muted-foreground")}>
          {row.original.expectedOutput}
        </p>
      ),
    },
    ...runs.map(
      (run): ColumnDef<ConversationComparisonRow> => ({
        id: run.id,
        header: () => (
          <ComparedRunHead
            agentParams={agentParams}
            datasetId={datasetId}
            run={run}
            revision={run.agentSettings.revision}
          />
        ),
        cell: ({ row }) => {
          const score = row.original.byRunId[run.id]?.score ?? null
          if (score === null) return <span className="text-muted-foreground">–</span>
          // The best score of the record, when two runs or more have one.
          const scores = runs.flatMap(
            (candidate) => row.original.byRunId[candidate.id]?.score ?? [],
          )
          const isBest = scores.length > 1 && score === Math.max(...scores)
          return (
            <Badge variant="secondary" className={isBest ? SUCCESS_BADGE_CLASSES : undefined}>
              {scoreOf(score, i18n.locale)}
            </Badge>
          )
        },
        meta: { headerClassName: "h-auto py-2 align-bottom", cellClassName: "tabular-nums" },
      }),
    ),
  ]
  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.key,
    getCoreRowModel: getCoreRowModel(),
    enableSorting: false,
  })
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">
          <Trans comment="The title of the records of the runs compared">Record by record</Trans>
        </h2>
        <p className="text-sm text-muted-foreground">
          <Trans>The score each run got on each record, the best one in green.</Trans>
        </p>
      </div>
      <DataTable table={table} empty={<Trans>These runs have no record yet.</Trans>} />
    </section>
  )
}
