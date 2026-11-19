import type { AgentParamsDto, ConversationRunOutputDto } from "@caseai-connect/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { Link } from "@tanstack/react-router"
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table"
import type { ReactNode } from "react"
import { fullDateTimeOf } from "@/lib/format-time"
import { scoreOf } from "../run-status"

const columnHelper = createColumnHelper<ConversationRunOutputDto>()

/** The texts of the headers, which the table translates. */
const runColumnLabels = {
  started: msg({ message: "Started", comment: "The header of the column of when a run started" }),
  version: msg({ message: "Version", comment: "The version of the agent a run evaluated" }),
  judge: msg({ message: "Judge model", comment: "The model that graded a run" }),
  judgeInstructions: msg({
    message: "Instructions for the judge",
    comment: "The header of the column of the instructions a run gave its judge",
  }),
  score: msg({ message: "Score", comment: "The average score of a run" }),
  graded: msg({ message: "Graded", comment: "How many records of a run are graded" }),
} satisfies Record<string, MessageDescriptor>

/** The columns of the runs of a dataset that stand at one status: a date opens its run. */
export function conversationRunColumnsOf({
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
  renderVersion: (run: ConversationRunOutputDto) => ReactNode
  /** What a row offers: the way to its run, and what the person can do with it. */
  renderActions: (run: ConversationRunOutputDto) => ReactNode
}): ColumnDef<ConversationRunOutputDto, unknown>[] {
  // Safe: each helper call types its own value, and the list holds them as columns of any value.
  return [
    columnHelper.accessor("createdAt", {
      header: translate(runColumnLabels.started),
      cell: (context) => (
        <Link
          to="/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/runs/$runId"
          params={{
            ...agent,
            datasetId: context.row.original.evaluationConversationDatasetId,
            runId: context.row.original.id,
          }}
          className="font-medium underline-offset-4 hover:underline"
        >
          {fullDateTimeOf(context.getValue(), locale)}
        </Link>
      ),
    }),
    columnHelper.accessor((run) => run.agentSettings.revision, {
      id: "version",
      header: translate(runColumnLabels.version),
      cell: (context) => renderVersion(context.row.original),
      meta: { headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
    }),
    columnHelper.accessor("judgeModel", {
      header: translate(runColumnLabels.judge),
      cell: (context) => <span className="font-mono text-xs">{context.getValue()}</span>,
    }),
    columnHelper.accessor((run) => run.judgeInstructions ?? "", {
      id: "judgeInstructions",
      header: translate(runColumnLabels.judgeInstructions),
      enableSorting: false,
      cell: (context) => {
        const instructions = context.getValue()
        if (instructions === "") return <span className="text-muted-foreground">–</span>
        return (
          // Two lines at most: the run's page shows them whole.
          <p
            title={instructions}
            className="line-clamp-2 max-w-64 min-w-40 whitespace-normal wrap-anywhere text-muted-foreground"
          >
            {instructions}
          </p>
        )
      },
    }),
    columnHelper.accessor((run) => run.summary?.averageScore ?? null, {
      id: "score",
      header: translate(runColumnLabels.score),
      cell: (context) => {
        const score = context.getValue()
        return score === null ? "–" : scoreOf(score, locale)
      },
      meta: { headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
    }),
    columnHelper.accessor((run) => run.summary?.graded ?? null, {
      id: "graded",
      header: translate(runColumnLabels.graded),
      cell: (context) => {
        const summary = context.row.original.summary
        return summary ? `${summary.graded} / ${summary.total}` : "–"
      },
      meta: { headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
    }),
    columnHelper.display({
      id: "actions",
      cell: (context) => (
        <div className="flex justify-end">{renderActions(context.row.original)}</div>
      ),
    }),
  ] as ColumnDef<ConversationRunOutputDto, unknown>[]
}
