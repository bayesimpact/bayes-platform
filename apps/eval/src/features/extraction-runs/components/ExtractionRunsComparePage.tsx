import type {
  AgentParamsDto,
  ExtractionDatasetOutputDto,
  ExtractionRunOutputDto,
  ExtractionRunRecordOutputDto,
  ExtractionRunRecordsOutputDto,
} from "@bayes-platform/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { type UseQueryResult, useQueries, useSuspenseQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { useMemo, useState } from "react"
import { AgentVersionsSheet } from "@/components/shared/AgentVersionsSheet"
import { CompareRunsPageFrame } from "@/components/shared/CompareRunsPageFrame"
import { Count } from "@/components/shared/Count"
import { type RunFigure, RunFiguresTable } from "@/components/shared/RunFiguresTable"
import { RunStatusBadge } from "@/components/shared/RunStatusBadge"
import { RunVersionButton } from "@/components/shared/RunVersionButton"
import { agentVersionsQueryOptions } from "@/features/agents"
import { columnsOfRole } from "@/lib/extraction-columns"
import { SUCCESS_TEXT_CLASSES } from "@/lib/success-classes"
import { extractionRunRecordsQueryOptions, projectExtractionRunsQueryOptions } from "../api/queries"
import { comparisonRowsOf } from "../comparison"
import { extractionRunParamsOf } from "../load-extraction-runs"
import { matchRateOf, percentOf } from "../match-rate"
import { ExtractionComparisonRecords } from "./ExtractionComparisonRecords"
import { inputKeyOf } from "./extraction-run-record-columns"

/** No record: the same list from one render to the next. */
const NO_RECORD: ExtractionRunRecordOutputDto[] = []

/**
 * What the page reads of the records of the runs compared, in the order of the runs. A function
 * of the module: the queries then give the same lists from one render to the next, while they
 * hold the same records.
 */
const pagesOf = (results: UseQueryResult<ExtractionRunRecordsOutputDto>[]) => ({
  records: results.map((result) => result.data?.records ?? NO_RECORD),
  // The run that asked the most records has the most pages.
  total: Math.max(0, ...results.map((result) => result.data?.total ?? 0)),
  isLoading: results.some((result) => result.isPending),
  hasFailed: results.some((result) => result.isError),
  /** Reads again the records that could not load. */
  retry: () => {
    for (const result of results) {
      if (result.isError) void result.refetch()
    }
  },
})

export type ExtractionRunsComparePageProps = {
  agentParams: AgentParamsDto
  /** The name of the agent, which titles the history of its versions. */
  agentName: string
  /** The dataset the runs asked: its name, and the columns that name each record. */
  dataset: ExtractionDatasetOutputDto
  /** The ids of the runs to compare, in the order the person picked them. */
  runIds: string[]
  /** The page of the records compared, counted from 0. */
  page: number
  onPageChange: (page: number) => void
}

/**
 * Runs of a dataset side by side: their figures, the best match rate in green, then the records
 * of the dataset, a page at a time, with where each stands in each run. Every run gives the same
 * page of its records, in the order of the dataset, and a record takes one row whatever the run.
 */
export function ExtractionRunsComparePage({
  agentParams,
  agentName,
  dataset,
  runIds,
  page,
  onPageChange,
}: ExtractionRunsComparePageProps) {
  const { i18n } = useLingui()
  const { data: projectRuns } = useSuspenseQuery(projectExtractionRunsQueryOptions(agentParams))
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
          run.evaluationExtractionDatasetId === dataset.id &&
          run.agentId === agentParams.agentId
          ? [run]
          : []
      }),
    [runIds, projectRuns, dataset.id, agentParams.agentId],
  )
  const [firstInputColumn] = columnsOfRole(dataset, "input")
  // useQueries: another page keeps the rows shown until its own arrive, for each run.
  const pages = useQueries({
    queries: runs.map((run) =>
      extractionRunRecordsQueryOptions(extractionRunParamsOf(agentParams, run.id), {
        page,
        // The same order for every run, whatever the order it stored its records in: the first
        // column the agent reads. Runs that asked the same records then share their pages.
        sortBy: firstInputColumn ? inputKeyOf(firstInputColumn.id) : undefined,
      }),
    ),
    combine: pagesOf,
  })
  const rows = useMemo(
    () =>
      comparisonRowsOf(
        runs.map((run, index) => ({ runId: run.id, records: pages.records[index] ?? NO_RECORD })),
        columnsOfRole(dataset, "input").map((column) => column.id),
      ),
    [runs, pages.records, dataset],
  )
  const runCount = runs.length
  const rates = runs.flatMap((run) => matchRateOf(run.summary) ?? [])
  const bestRate = rates.length > 0 ? Math.max(...rates) : null
  const figures: RunFigure<ExtractionRunOutputDto>[] = [
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
          revision={run.agentRevision}
          versions={versions}
          onShow={setShownRevision}
        />
      ),
    },
    {
      key: "matchRate",
      label: (
        <Trans comment="The share of a run's records that match on every compared field">
          Match rate
        </Trans>
      ),
      render: (run) => {
        const rate = matchRateOf(run.summary)
        if (rate === null) return "–"
        return (
          <span
            className={cn("font-medium", rate === bestRate && runCount > 1 && SUCCESS_TEXT_CLASSES)}
          >
            {percentOf(rate, i18n.locale)}
          </span>
        )
      },
    },
    {
      key: "matches",
      label: (
        <Trans comment="How many records of a run match on every compared field">Matches</Trans>
      ),
      render: (run) => <Count value={run.summary?.perfectMatches} />,
    },
    {
      key: "mismatches",
      label: (
        <Trans comment="How many records of a run have a field that differs from the value expected">
          Mismatches
        </Trans>
      ),
      render: (run) => <Count value={run.summary?.mismatches} />,
    },
    {
      key: "errors",
      label: <Trans comment="How many records of a run an error stopped">Errors</Trans>,
      render: (run) => <Count value={run.summary?.errors} />,
    },
    {
      key: "total",
      label: <Trans comment="How many records a run asked">Records</Trans>,
      render: (run) => <Count value={run.summary?.total} />,
    },
  ]
  return (
    <CompareRunsPageFrame agentParams={agentParams} dataset={dataset} runCount={runCount}>
      <RunFiguresTable
        agentParams={agentParams}
        datasetId={dataset.id}
        runs={runs}
        figures={figures}
        revisionOf={(run) => run.agentRevision}
      />
      <ExtractionComparisonRecords
        agentParams={agentParams}
        datasetId={dataset.id}
        runs={runs}
        rows={rows}
        page={page}
        onPageChange={onPageChange}
        recordTotal={pages.total}
        isLoading={pages.isLoading}
        hasFailed={pages.hasFailed}
        onRetry={pages.retry}
        isUneven={new Set(runs.map((run) => run.summary?.total ?? 0)).size > 1}
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
