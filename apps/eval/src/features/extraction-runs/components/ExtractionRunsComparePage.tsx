import type {
  AgentParamsDto,
  ExtractionDatasetOutputDto,
  ExtractionRunOutputDto,
  ExtractionRunRecordOutputDto,
} from "@caseai-connect/eval-contracts"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import type { ReactNode } from "react"
import { BackLink } from "@/components/shared/BackLink"
import { PageContainer } from "@/components/shared/PageContainer"
import { PageHeader } from "@/components/shared/PageHeader"
import { RunStatusBadge } from "@/components/shared/RunStatusBadge"
import { TimeAgo } from "@/components/shared/TimeAgo"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cellTextOf, columnsOfRole } from "@/lib/extraction-columns"
import { shortIdOf } from "@/lib/short-id"
import { extractionRunRecordsQueryOptions, projectExtractionRunsQueryOptions } from "../api/queries"
import { matchedFieldsOf } from "../key-mapping"
import { extractionRunParamsOf } from "../load-extraction-runs"
import { matchRateOf, percentOf } from "../match-rate"
import { RecordStatusBadge } from "./RecordStatusBadge"

export type ExtractionRunsComparePageProps = {
  agentParams: AgentParamsDto
  /** The dataset the runs asked: its name, and the columns that name each record. */
  dataset: ExtractionDatasetOutputDto
  /** The ids of the runs to compare, in the order the person picked them. */
  runIds: string[]
}

/**
 * Runs of a dataset side by side: their figures, the best match rate in green, then each record
 * of the dataset with where it stands in each run.
 */
export function ExtractionRunsComparePage({
  agentParams,
  dataset,
  runIds,
}: ExtractionRunsComparePageProps) {
  const { i18n } = useLingui()
  const { data: projectRuns } = useSuspenseQuery(projectExtractionRunsQueryOptions(agentParams))
  // The runs of this dataset among those asked, in the order the person picked them.
  const runs = runIds.flatMap((runId) => {
    const run = projectRuns.find((candidate) => candidate.id === runId)
    return run && run.evaluationExtractionDatasetId === dataset.id ? [run] : []
  })
  const recordsByRun = useSuspenseQueries({
    queries: runs.map((run) =>
      extractionRunRecordsQueryOptions(extractionRunParamsOf(agentParams, run.id)),
    ),
  })
  const datasetRuns = {
    to: "/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId",
    params: { ...agentParams, datasetId: dataset.id },
    search: { tab: "runs" },
  } as const
  const datasetName = dataset.name
  const runCount = runs.length
  const rates = runs.flatMap((run) => matchRateOf(run.summary) ?? [])
  const bestRate = rates.length > 0 ? Math.max(...rates) : null
  const metrics: {
    key: string
    label: ReactNode
    render: (run: ExtractionRunOutputDto) => ReactNode
  }[] = [
    {
      key: "status",
      label: <Trans comment="A row of the comparison of runs: where each run stands">Status</Trans>,
      render: (run) => <RunStatusBadge status={run.status} />,
    },
    {
      key: "version",
      label: <Trans comment="The version of the agent a run evaluated">Version</Trans>,
      render: (run) => run.agentRevision,
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
            className={cn(
              "font-medium",
              rate === bestRate && runCount > 1 && "text-green-700 dark:text-green-400",
            )}
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
      render: (run) => run.summary?.perfectMatches ?? "–",
    },
    {
      key: "mismatches",
      label: (
        <Trans comment="How many records of a run have a field that differs from the value expected">
          Mismatches
        </Trans>
      ),
      render: (run) => run.summary?.mismatches ?? "–",
    },
    {
      key: "errors",
      label: <Trans comment="How many records of a run an error stopped">Errors</Trans>,
      render: (run) => run.summary?.errors ?? "–",
    },
    {
      key: "total",
      label: <Trans comment="How many records a run asked">Records</Trans>,
      render: (run) => run.summary?.total ?? "–",
    },
  ]
  const rows = comparisonRowsOf(
    runs.map((run, index) => ({ runId: run.id, records: recordsByRun[index]?.data ?? [] })),
    columnsOfRole(dataset, "input").map((column) => column.id),
  )
  const runHeads = runs.map((run) => (
    <TableHead key={run.id} className="h-auto py-2 align-bottom">
      <div className="flex flex-col gap-0.5">
        <Link
          to="/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/runs/$runId"
          params={{ ...agentParams, datasetId: dataset.id, runId: run.id }}
          title={run.id}
          className="font-mono text-xs font-medium text-foreground underline-offset-4 hover:underline"
        >
          {shortIdOf(run.id)}
        </Link>
        <span className="text-xs font-normal">
          <TimeAgo moment={run.createdAt} />
        </span>
      </div>
    </TableHead>
  ))
  return (
    <PageContainer>
      <PageHeader
        back={
          <BackLink {...datasetRuns}>
            <Trans comment="The link back from a run to the runs of its dataset">Runs</Trans>
          </BackLink>
        }
        title={<Trans>Compare runs</Trans>}
        description={
          <Plural
            value={runCount}
            _0={`No run of ${datasetName} to compare`}
            one={`# run of ${datasetName}`}
            other={`# runs of ${datasetName}, side by side`}
          />
        }
      />
      {runCount === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          <Trans>These runs are gone, or are not runs of this dataset.</Trans>
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">
              <Trans comment="The title of the figures of the runs compared">Figures</Trans>
            </h2>
            <div className="overflow-hidden rounded-lg border bg-background dark:bg-card">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-9 text-xs">
                      <Trans comment="The header of the column of what the comparison measures">
                        Figure
                      </Trans>
                    </TableHead>
                    {runHeads}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.map((metric) => (
                    <TableRow key={metric.key}>
                      <TableCell className="text-muted-foreground">{metric.label}</TableCell>
                      {runs.map((run) => (
                        <TableCell key={run.id} className="tabular-nums">
                          {metric.render(run)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">
                <Trans comment="The title of the records of the runs compared">
                  Record by record
                </Trans>
              </h2>
              <p className="text-sm text-muted-foreground">
                <Trans>
                  Where each record stands in each run, with how many of its compared fields match.
                </Trans>
              </p>
            </div>
            <div className="overflow-hidden rounded-lg border bg-background dark:bg-card">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-9 text-xs">
                      <Trans comment="The header of the column of the records compared">
                        Record
                      </Trans>
                    </TableHead>
                    {runHeads}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={runCount + 1}
                        className="h-24 text-center text-muted-foreground"
                      >
                        <Trans>These runs have no record yet.</Trans>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell className="align-top">
                          <p className="line-clamp-2 max-w-96 min-w-40 whitespace-normal wrap-anywhere">
                            {row.label || "–"}
                          </p>
                        </TableCell>
                        {runs.map((run) => {
                          const record = row.byRunId[run.id]
                          const fields = record ? matchedFieldsOf(record.comparison) : null
                          const matched = fields?.matched ?? 0
                          const scored = fields?.scored ?? 0
                          return (
                            <TableCell key={run.id} className="align-top">
                              {record ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <RecordStatusBadge status={record.status} />
                                  {scored > 0 ? (
                                    <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                                      <Trans comment="Beside a record in the comparison of runs: its compared fields that match, out of all of them, such as 1 / 2 fields">
                                        {matched} / {scored} fields
                                      </Trans>
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">–</span>
                              )}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      )}
    </PageContainer>
  )
}

/** A record of the dataset, in the comparison: what names it, and its record in each run. */
type ComparisonRow = {
  key: string
  label: string
  byRunId: Record<string, ExtractionRunRecordOutputDto | undefined>
}

/**
 * The rows of the comparison: each record of the dataset one run or more asked, in the order the
 * first run that asked it holds it, named by what the agent read.
 */
function comparisonRowsOf(
  runs: { runId: string; records: ExtractionRunRecordOutputDto[] }[],
  inputColumnIds: string[],
): ComparisonRow[] {
  const rows = new Map<string, ComparisonRow>()
  for (const { runId, records } of runs) {
    for (const record of records) {
      const key = record.evaluationExtractionDatasetRecordId
      const row = rows.get(key) ?? {
        key,
        label: inputColumnIds
          .map((columnId) => cellTextOf(record.datasetRecordData?.[columnId]))
          .filter(Boolean)
          .join(" · "),
        byRunId: {},
      }
      row.byRunId[runId] = record
      rows.set(key, row)
    }
  }
  return [...rows.values()]
}
