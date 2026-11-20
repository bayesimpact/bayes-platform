import type {
  AgentParamsDto,
  ConversationRunOutputDto,
  ConversationRunRecordOutputDto,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { useState } from "react"
import { ComparedRunHead } from "@/components/shared/ComparedRunHead"
import { CompareRunsPageFrame } from "@/components/shared/CompareRunsPageFrame"
import { type RunFigure, RunFiguresTable } from "@/components/shared/RunFiguresTable"
import { RunStatusBadge } from "@/components/shared/RunStatusBadge"
import { RunVersionButton } from "@/components/shared/RunVersionButton"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AgentVersionsSheet, agentVersionsQueryOptions } from "@/features/campaigns"
import {
  conversationRunRecordsQueryOptions,
  projectConversationRunsQueryOptions,
} from "../api/queries"
import { runParamsOf } from "../load-conversation-runs"
import { scoreOf } from "../score"

export type ConversationRunsComparePageProps = {
  agentParams: AgentParamsDto
  /** The name of the agent, which titles the history of its versions. */
  agentName: string
  /** The dataset the runs asked. */
  dataset: { id: string; name: string }
  /** The ids of the runs to compare, in the order the person picked them. */
  runIds: string[]
}

/**
 * Runs of a conversation dataset side by side: their figures, the best average score in green
 * and each version a link to the history of the agent's versions,
 * then each record of the dataset with the score each run got on it, the best one in green.
 */
export function ConversationRunsComparePage({
  agentParams,
  agentName,
  dataset,
  runIds,
}: ConversationRunsComparePageProps) {
  const { i18n } = useLingui()
  const { data: projectRuns } = useSuspenseQuery(projectConversationRunsQueryOptions(agentParams))
  const { data: versions } = useSuspenseQuery(agentVersionsQueryOptions(agentParams))
  // The version of a run whose history shows, to compare it with the others.
  const [shownRevision, setShownRevision] = useState<number | null>(null)
  const shownVersion = versions.find((version) => version.revision === shownRevision)
  // The agent's runs of this dataset among those asked, in the order the person picked them.
  const runs = runIds.flatMap((runId) => {
    const run = projectRuns.find((candidate) => candidate.id === runId)
    return run &&
      run.evaluationConversationDatasetId === dataset.id &&
      run.agentId === agentParams.agentId
      ? [run]
      : []
  })
  const recordsByRun = useSuspenseQueries({
    queries: runs.map((run) =>
      conversationRunRecordsQueryOptions(runParamsOf(agentParams, run.id)),
    ),
  })
  const runCount = runs.length
  const averages = runs.flatMap((run) => run.summary?.averageScore ?? [])
  const bestAverage = averages.length > 0 ? Math.max(...averages) : null
  const figures: RunFigure<ConversationRunOutputDto>[] = [
    {
      key: "status",
      label: <Trans comment="A row of the comparison of runs: where each run stands">Status</Trans>,
      render: (run) => <RunStatusBadge status={run.status} />,
    },
    {
      key: "version",
      label: <Trans comment="The version of the agent a run evaluated">Version</Trans>,
      render: (run) => (
        <RunVersionButton
          revision={run.agentSettings.revision}
          versions={versions}
          onShow={setShownRevision}
        />
      ),
    },
    {
      key: "model",
      label: <Trans comment="The model of the agent in a run">Model</Trans>,
      render: (run) => <span className="font-mono text-xs">{run.agentSettings.model}</span>,
    },
    {
      key: "judgeModel",
      label: <Trans comment="The model that graded a run">Judge model</Trans>,
      render: (run) => <span className="font-mono text-xs">{run.judgeModel}</span>,
    },
    // Only when a run gave its judge instructions: scores graded on other terms do not compare.
    ...(runs.some((run) => run.judgeInstructions)
      ? [
          {
            key: "judgeInstructions",
            label: (
              <Trans comment="A row of the comparison of runs: what each run told its judge">
                Instructions for the judge
              </Trans>
            ),
            render: (run: ConversationRunOutputDto) =>
              run.judgeInstructions ? (
                <p
                  title={run.judgeInstructions}
                  className="line-clamp-3 max-w-64 min-w-40 whitespace-normal wrap-anywhere"
                >
                  {run.judgeInstructions}
                </p>
              ) : (
                "–"
              ),
          },
        ]
      : []),
    {
      key: "averageScore",
      label: <Trans comment="The average score of a run">Average score</Trans>,
      render: (run) => {
        const average = run.summary?.averageScore
        if (average === null || average === undefined) return "–"
        return (
          <span
            className={cn(
              "font-medium",
              average === bestAverage && runCount > 1 && "text-green-700 dark:text-green-400",
            )}
          >
            {scoreOf(average, i18n.locale)}
          </span>
        )
      },
    },
    {
      key: "total",
      label: <Trans comment="How many records a run asked">Records</Trans>,
      render: (run) => run.summary?.total ?? "–",
    },
    {
      key: "graded",
      label: <Trans comment="How many records of a run the judge graded">Graded</Trans>,
      render: (run) => run.summary?.graded ?? "–",
    },
    {
      key: "errors",
      label: <Trans comment="How many records of a run an error stopped">Errors</Trans>,
      render: (run) => run.summary?.errors ?? "–",
    },
  ]
  const rows = comparisonRowsOf(
    runs.map((run, index) => ({ runId: run.id, records: recordsByRun[index]?.data ?? [] })),
  )
  return (
    <CompareRunsPageFrame agentParams={agentParams} dataset={dataset} runCount={runCount}>
      <RunFiguresTable
        agentParams={agentParams}
        datasetId={dataset.id}
        runs={runs}
        figures={figures}
        revisionOf={(run) => run.agentSettings.revision}
      />
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">
            <Trans comment="The title of the records of the runs compared">Record by record</Trans>
          </h2>
          <p className="text-sm text-muted-foreground">
            <Trans>The score each run got on each record, the best one in green.</Trans>
          </p>
        </div>
        <div className="overflow-hidden rounded-lg border bg-background dark:bg-card">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 text-xs">#</TableHead>
                <TableHead className="h-9 text-xs">
                  <Trans comment="What an evaluation sends to the agent">Input</Trans>
                </TableHead>
                <TableHead className="h-9 text-xs">
                  <Trans comment="The answer an evaluation expects from the agent">
                    Expected output
                  </Trans>
                </TableHead>
                {runs.map((run) => (
                  <ComparedRunHead
                    key={run.id}
                    agentParams={agentParams}
                    datasetId={dataset.id}
                    run={run}
                    revision={run.agentSettings.revision}
                  />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={runCount + 3}
                    className="h-24 text-center text-muted-foreground"
                  >
                    <Trans>These runs have no record yet.</Trans>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, index) => {
                  const scores = runs.flatMap((run) => row.byRunId[run.id]?.score ?? [])
                  const bestScore = scores.length > 1 ? Math.max(...scores) : null
                  return (
                    <TableRow key={row.key}>
                      <TableCell className="align-top font-mono text-xs text-muted-foreground tabular-nums">
                        {index + 1}
                      </TableCell>
                      <TableCell className="align-top">
                        <p
                          title={row.input}
                          className="line-clamp-3 max-w-80 min-w-40 whitespace-pre-wrap wrap-anywhere"
                        >
                          {row.input}
                        </p>
                      </TableCell>
                      <TableCell className="align-top">
                        <p className="line-clamp-3 max-w-80 min-w-40 whitespace-pre-wrap wrap-anywhere text-muted-foreground">
                          {row.expectedOutput}
                        </p>
                      </TableCell>
                      {runs.map((run) => {
                        const score = row.byRunId[run.id]?.score ?? null
                        return (
                          <TableCell key={run.id} className="align-top tabular-nums">
                            {score === null ? (
                              <span className="text-muted-foreground">–</span>
                            ) : (
                              <Badge
                                variant="secondary"
                                className={
                                  score === bestScore
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                                    : undefined
                                }
                              >
                                {scoreOf(score, i18n.locale)}
                              </Badge>
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>
      {shownVersion ? (
        <AgentVersionsSheet
          isOpen
          onOpenChange={(isOpen) => {
            if (!isOpen) setShownRevision(null)
          }}
          agentName={agentName}
          versions={versions}
          selectedId={shownVersion.id}
          selectedNote={<Trans>The run used this version</Trans>}
          onSelect={null}
        />
      ) : null}
    </CompareRunsPageFrame>
  )
}

/** A record of the dataset, in the comparison: what it asks, and its record in each run. */
type ComparisonRow = {
  key: string
  input: string
  expectedOutput: string
  byRunId: Record<string, ConversationRunRecordOutputDto | undefined>
}

/**
 * The rows of the comparison: each record of the dataset one run or more asked, in the order the
 * first run that asked it holds it. A run's record whose dataset record was deleted has no id to
 * match on: it takes the row of the same place in its run.
 */
function comparisonRowsOf(
  runs: { runId: string; records: ConversationRunRecordOutputDto[] }[],
): ComparisonRow[] {
  const rows = new Map<string, ComparisonRow>()
  for (const { runId, records } of runs) {
    records.forEach((record, index) => {
      const key = record.evaluationConversationDatasetRecordId ?? `#${index}`
      const row = rows.get(key) ?? {
        key,
        input: record.input,
        expectedOutput: record.expectedOutput,
        byRunId: {},
      }
      row.byRunId[runId] = record
      rows.set(key, row)
    })
  }
  return [...rows.values()]
}
