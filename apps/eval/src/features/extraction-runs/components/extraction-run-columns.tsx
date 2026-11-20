import type { AgentParamsDto, ExtractionRunOutputDto } from "@caseai-connect/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { Link } from "@tanstack/react-router"
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table"
import type { ReactNode } from "react"
import { TimeAgo } from "@/components/shared/TimeAgo"
import { shortIdOf } from "@/lib/short-id"
import { matchRateOf, percentOf } from "../match-rate"
import { RunCompareCheckbox } from "./RunCompareCheckbox"

const columnHelper = createColumnHelper<ExtractionRunOutputDto>()

/** The texts of the headers, which the table translates. */
const runColumnLabels = {
  select: msg({
    message: "Compare",
    comment: "The header of the column of the boxes that pick the runs to compare",
  }),
  id: msg({ message: "ID", comment: "The header of the column of the short ids of the runs" }),
  started: msg({ message: "Started", comment: "The header of the column of when a run started" }),
  version: msg({ message: "Version", comment: "The version of the agent a run evaluated" }),
  matchRate: msg({
    message: "Match rate",
    comment: "The share of a run's records that match on every compared field",
  }),
  matches: msg({
    message: "Matches",
    comment: "How many records of a run match on every compared field, out of all of them",
  }),
  errors: msg({ message: "Errors", comment: "How many records of a run an error stopped" }),
} satisfies Record<string, MessageDescriptor>

/** The columns of the extraction runs of a dataset that stand at one status: an id opens its run. */
export function extractionRunColumnsOf({
  agent,
  locale,
  translate,
  renderVersion,
  renderActions,
}: {
  agent: AgentParamsDto
  locale: string
  translate: (descriptor: MessageDescriptor) => string
  /** The version a run asked, which opens the history of the agent's versions on it. */
  renderVersion: (run: ExtractionRunOutputDto) => ReactNode
  /** What a row offers: the way to its run, and what the person can do with it. */
  renderActions: (run: ExtractionRunOutputDto) => ReactNode
}): ColumnDef<ExtractionRunOutputDto, unknown>[] {
  // Safe: each helper call types its own value, and the list holds them as columns of any value.
  return [
    columnHelper.display({
      id: "select",
      header: () => <span className="sr-only">{translate(runColumnLabels.select)}</span>,
      // The component itself, so the box stays the same one from one render to the next.
      cell: RunCompareCheckbox,
    }),
    columnHelper.accessor((run) => shortIdOf(run.id), {
      id: "id",
      header: translate(runColumnLabels.id),
      enableSorting: false,
      cell: (context) => (
        <Link
          to="/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/runs/$runId"
          params={{
            ...agent,
            datasetId: context.row.original.evaluationExtractionDatasetId,
            runId: context.row.original.id,
          }}
          title={context.row.original.id}
          className="font-mono text-xs font-medium underline-offset-4 hover:underline"
        >
          {context.getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor("createdAt", {
      header: translate(runColumnLabels.started),
      // How long ago, with the full date and time on hover.
      cell: (context) => <TimeAgo moment={context.getValue()} />,
    }),
    columnHelper.accessor("agentRevision", {
      header: translate(runColumnLabels.version),
      cell: (context) => renderVersion(context.row.original),
      meta: { headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
    }),
    columnHelper.accessor((run) => matchRateOf(run.summary), {
      id: "matchRate",
      header: translate(runColumnLabels.matchRate),
      cell: (context) => {
        const rate = context.getValue()
        return rate === null ? "–" : percentOf(rate, locale)
      },
      meta: { headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
    }),
    columnHelper.accessor((run) => run.summary?.perfectMatches ?? null, {
      id: "matches",
      header: translate(runColumnLabels.matches),
      cell: (context) => {
        const summary = context.row.original.summary
        return summary ? `${summary.perfectMatches} / ${summary.total}` : "–"
      },
      meta: { headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
    }),
    columnHelper.accessor((run) => run.summary?.errors ?? null, {
      id: "errors",
      header: translate(runColumnLabels.errors),
      cell: (context) => context.getValue() ?? "–",
      meta: { headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
    }),
    columnHelper.display({
      id: "actions",
      cell: (context) => (
        <div className="flex justify-end">{renderActions(context.row.original)}</div>
      ),
    }),
  ] as ColumnDef<ExtractionRunOutputDto, unknown>[]
}
