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
  score: msg({ message: "Score", comment: "The average score of a run" }),
  graded: msg({ message: "Graded", comment: "How many records of a run are graded" }),
} satisfies Record<string, MessageDescriptor>

/** The columns of the runs of a dataset that stand at one status: a date opens its run. */
export function conversationRunColumnsOf({
  agent,
  locale,
  translate,
  renderActions,
}: {
  agent: AgentParamsDto
  locale: string
  translate: (descriptor: MessageDescriptor) => string
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
      meta: { headerClassName: "text-right", cellClassName: "text-right tabular-nums" },
    }),
    columnHelper.accessor("judgeModel", {
      header: translate(runColumnLabels.judge),
      cell: (context) => <span className="font-mono text-xs">{context.getValue()}</span>,
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
