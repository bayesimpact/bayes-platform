import type {
  AgentParamsDto,
  ConversationRunOutputDto,
  ConversationRunRecordOutputDto,
} from "@bayes-platform/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { useMemo, useState } from "react"
import { AgentVersionsSheet } from "@/components/shared/AgentVersionsSheet"
import { CompareRunsPageFrame } from "@/components/shared/CompareRunsPageFrame"
import { Count } from "@/components/shared/Count"
import { type RunFigure, RunFiguresTable } from "@/components/shared/RunFiguresTable"
import { RunStatusBadge } from "@/components/shared/RunStatusBadge"
import { RunVersionButton } from "@/components/shared/RunVersionButton"
import { agentVersionsQueryOptions } from "@/features/agents"
import { SUCCESS_TEXT_CLASSES } from "@/lib/success-classes"
import {
  conversationRunRecordsQueryOptions,
  projectConversationRunsQueryOptions,
} from "../api/queries"
import { comparisonRowsOf } from "../comparison"
import { runParamsOf } from "../load-conversation-runs"
import { scoreOf } from "../score"
import { ConversationComparisonRecords } from "./ConversationComparisonRecords"

/**
 * The records of each run compared, in the order of the runs. A function of the module: the
 * queries then give the same lists from one render to the next, while they hold the same records.
 */
const recordsOf = (results: { data: ConversationRunRecordOutputDto[] }[]) =>
  results.map((result) => result.data)

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
  // The agent's runs of this dataset among those asked, in the order the person picked them: the
  // same list from one render to the next, as the table's rows come from it.
  const runs = useMemo(
    () =>
      runIds.flatMap((runId) => {
        const run = projectRuns.find((candidate) => candidate.id === runId)
        return run &&
          run.evaluationConversationDatasetId === dataset.id &&
          run.agentId === agentParams.agentId
          ? [run]
          : []
      }),
    [runIds, projectRuns, dataset.id, agentParams.agentId],
  )
  const recordsByRun = useSuspenseQueries({
    queries: runs.map((run) =>
      conversationRunRecordsQueryOptions(runParamsOf(agentParams, run.id)),
    ),
    combine: recordsOf,
  })
  const rows = useMemo(
    () =>
      comparisonRowsOf(
        runs.map((run, index) => ({ runId: run.id, records: recordsByRun[index] ?? [] })),
      ),
    [runs, recordsByRun],
  )
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
              average === bestAverage && runCount > 1 && SUCCESS_TEXT_CLASSES,
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
      render: (run) => <Count value={run.summary?.total} />,
    },
    {
      key: "graded",
      label: <Trans comment="How many records of a run the judge graded">Graded</Trans>,
      render: (run) => <Count value={run.summary?.graded} />,
    },
    {
      key: "errors",
      label: <Trans comment="How many records of a run an error stopped">Errors</Trans>,
      render: (run) => <Count value={run.summary?.errors} />,
    },
  ]
  return (
    <CompareRunsPageFrame agentParams={agentParams} dataset={dataset} runCount={runCount}>
      <RunFiguresTable
        agentParams={agentParams}
        datasetId={dataset.id}
        runs={runs}
        figures={figures}
        revisionOf={(run) => run.agentSettings.revision}
      />
      <ConversationComparisonRecords
        agentParams={agentParams}
        datasetId={dataset.id}
        runs={runs}
        rows={rows}
      />
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
