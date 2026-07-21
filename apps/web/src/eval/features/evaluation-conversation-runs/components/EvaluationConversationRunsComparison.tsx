import { Badge } from "@caseai-connect/ui/shad/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@caseai-connect/ui/shad/card"
import { cn } from "@caseai-connect/ui/utils"
import { type ReactNode, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { TruncatedCell } from "@/common/components/shared/RecordTableParts"
import { selectAgentsData } from "@/common/features/agents/agents.selectors"
import { useValue } from "@/common/hooks/use-value"
import { buildSince } from "@/common/utils/build-date"
import { shortRunId } from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.helpers"
import type {
  EvaluationConversationRun,
  EvaluationConversationRunRecord,
} from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.models"
import { useEvaluationConversationRunPath } from "@/eval/hooks/use-evaluation-conversation-run-path"
import { RunStatusBadge } from "./RunStatusBadge"

type Props = {
  runs: EvaluationConversationRun[]
  recordsByRunId: Record<string, EvaluationConversationRunRecord[]>
}

// Opens the run in a new tab so the comparison stays put behind it.
function RunIdLink({ runId, className }: { runId: string; className?: string }) {
  const { buildConversationRunPath } = useEvaluationConversationRunPath()
  return (
    <Link
      to={buildConversationRunPath({ runId })}
      target="_blank"
      rel="noreferrer"
      className={cn("font-mono text-primary hover:underline", className)}
    >
      {shortRunId(runId)}
    </Link>
  )
}

function ScoreBadge({ score, highlight }: { score: number | null; highlight?: boolean }) {
  if (score === null) return <span className="text-muted-foreground">-</span>
  return <Badge variant={highlight ? "success" : "secondary"}>{score}</Badge>
}

export function EvaluationConversationRunsComparison({ runs, recordsByRunId }: Props) {
  const agents = useValue(selectAgentsData)

  const agentNameById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent.name])),
    [agents],
  )

  // Best average score across runs; used to highlight the winning column.
  const bestAverageScore = useMemo(() => {
    const scores = runs
      .map((run) => run.summary?.averageScore)
      .filter((score): score is number => score !== null && score !== undefined)
    return scores.length > 0 ? Math.max(...scores) : null
  }, [runs])

  return (
    <div className="flex flex-col gap-6">
      <SummaryComparison
        runs={runs}
        agentNameById={agentNameById}
        bestAverageScore={bestAverageScore}
      />
      <RecordsComparison runs={runs} recordsByRunId={recordsByRunId} />
    </div>
  )
}

function RunColumnHeader({
  run,
  agentName,
}: {
  run: EvaluationConversationRun
  agentName: string | undefined
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium">{agentName ?? "-"}</span>
      <RunIdLink runId={run.id} className="text-xs" />

      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {t("evaluationConversationRun:version.revision", { revision: run.agentSettings.revision })}
        {" · "}
        {buildSince(run.updatedAt)}
      </span>
    </div>
  )
}

function SummaryComparison({
  runs,
  agentNameById,
  bestAverageScore,
}: {
  runs: EvaluationConversationRun[]
  agentNameById: Map<string, string>
  bestAverageScore: number | null
}) {
  const { t } = useTranslation()

  const rows: {
    key: string
    label: string
    render: (run: EvaluationConversationRun) => ReactNode
  }[] = [
    {
      key: "status",
      label: t("evaluationConversationRun:comparison.metrics.status"),
      render: (run) => <RunStatusBadge status={run.status} />,
    },
    {
      key: "agent",
      label: t("evaluationConversationRun:comparison.metrics.agent"),
      render: (run) => <span className="text-sm">{agentNameById.get(run.agentId) ?? "-"}</span>,
    },
    {
      key: "version",
      label: t("evaluationConversationRun:comparison.metrics.version"),
      render: (run) => (
        <span className="text-sm whitespace-nowrap">
          {t("evaluationConversationRun:version.revision", {
            revision: run.agentSettings.revision,
          })}
        </span>
      ),
    },
    {
      key: "model",
      label: t("evaluationConversationRun:comparison.metrics.model"),
      render: (run) => (
        <span className="text-sm font-mono whitespace-nowrap">{run.agentSettings.model}</span>
      ),
    },
    {
      key: "judgeModel",
      label: t("evaluationConversationRun:comparison.metrics.judgeModel"),
      render: (run) => (
        <span className="text-sm font-mono whitespace-nowrap">{run.judgeModel}</span>
      ),
    },
    {
      key: "averageScore",
      label: t("evaluationConversationRun:comparison.metrics.averageScore"),
      render: (run) => {
        const averageScore = run.summary?.averageScore
        if (averageScore === null || averageScore === undefined) {
          return <span className="text-muted-foreground">-</span>
        }
        const rounded = Math.round(averageScore * 10) / 10
        const isBest = bestAverageScore !== null && averageScore === bestAverageScore
        return (
          <span
            className={cn(
              "text-sm font-medium whitespace-nowrap",
              isBest && "text-green-700 dark:text-green-400",
            )}
          >
            {t("evaluationConversationRun:history.averageScoreValue", { averageScore: rounded })}
          </span>
        )
      },
    },
    {
      key: "total",
      label: t("evaluationConversationRun:comparison.metrics.total"),
      render: (run) => <span className="text-sm">{run.summary?.total ?? 0}</span>,
    },
    {
      key: "graded",
      label: t("evaluationConversationRun:comparison.metrics.graded"),
      render: (run) => <span className="text-sm">{run.summary?.graded ?? 0}</span>,
    },
    {
      key: "errors",
      label: t("evaluationConversationRun:comparison.metrics.errors"),
      render: (run) => <span className="text-sm">{run.summary?.errors ?? 0}</span>,
    },
  ]

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle>{t("evaluationConversationRun:comparison.summary")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="bg-muted/50 [&_tr]:border-b">
              <tr className="border-b transition-colors">
                <th className="text-foreground h-auto px-3 py-2 text-left align-bottom font-medium">
                  {t("evaluationConversationRun:comparison.metric")}
                </th>
                {runs.map((run) => (
                  <th
                    key={run.id}
                    className="text-foreground h-auto px-3 py-2 text-left align-bottom font-medium"
                  >
                    <RunColumnHeader run={run} agentName={agentNameById.get(run.agentId)} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.key}
                  className={cn(
                    "border-b transition-colors hover:bg-muted/50",
                    index % 2 !== 0 && "bg-muted/30",
                  )}
                >
                  <td className="p-3 align-middle font-medium text-muted-foreground whitespace-nowrap">
                    {row.label}
                  </td>
                  {runs.map((run) => (
                    <td key={run.id} className="p-3 align-middle">
                      {row.render(run)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

type ComparisonRow = {
  key: string
  input: string
  expectedOutput: string
  scoresByRunId: Record<string, number | null>
}

function buildComparisonRows(
  runs: EvaluationConversationRun[],
  recordsByRunId: Record<string, EvaluationConversationRunRecord[]>,
): ComparisonRow[] {
  // Align records across runs by their source dataset-record id. Runs of the same
  // dataset share those ids, so the reference is whichever run returned the most
  // records; other runs are matched by id, falling back to positional index.
  const reference = runs.reduce<EvaluationConversationRunRecord[]>((longest, run) => {
    const records = recordsByRunId[run.id] ?? []
    return records.length > longest.length ? records : longest
  }, [])

  return reference.map((referenceRecord, index) => {
    const datasetRecordId = referenceRecord.evaluationConversationDatasetRecordId
    const scoresByRunId: Record<string, number | null> = {}
    for (const run of runs) {
      const records = recordsByRunId[run.id] ?? []
      const match = datasetRecordId
        ? records.find((record) => record.evaluationConversationDatasetRecordId === datasetRecordId)
        : records[index]
      scoresByRunId[run.id] = match?.score ?? null
    }
    return {
      key: datasetRecordId ?? `#${index}`,
      input: referenceRecord.input,
      expectedOutput: referenceRecord.expectedOutput,
      scoresByRunId,
    }
  })
}

function RecordsComparison({
  runs,
  recordsByRunId,
}: {
  runs: EvaluationConversationRun[]
  recordsByRunId: Record<string, EvaluationConversationRunRecord[]>
}) {
  const { t } = useTranslation()
  const rows = useMemo(() => buildComparisonRows(runs, recordsByRunId), [runs, recordsByRunId])

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle>{t("evaluationConversationRun:comparison.records")}</CardTitle>
        <CardDescription>
          {t("evaluationConversationRun:comparison.recordsDescription", { count: rows.length })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="bg-muted/50 [&_tr]:border-b">
              <tr className="border-b transition-colors">
                <th className="text-foreground h-auto px-3 py-2 text-left align-bottom font-medium">
                  #
                </th>
                <th className="text-foreground h-auto px-3 py-2 text-left align-bottom font-medium">
                  {t("evaluationConversationRun:comparison.input")}
                </th>
                <th className="text-foreground h-auto px-3 py-2 text-left align-bottom font-medium">
                  {t("evaluationConversationRun:comparison.expectedOutput")}
                </th>
                {runs.map((run) => (
                  <th
                    key={run.id}
                    className="text-foreground h-auto px-3 py-2 text-left align-bottom font-medium whitespace-nowrap"
                  >
                    <RunIdLink runId={run.id} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3 + runs.length} className="h-24 text-center text-muted-foreground">
                    {t("evaluationConversationRun:results.noRecords")}
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => {
                  const scores = runs
                    .map((run) => row.scoresByRunId[run.id])
                    .filter((score): score is number => score !== null && score !== undefined)
                  const bestScore = scores.length > 0 ? Math.max(...scores) : null
                  return (
                    <tr
                      key={row.key}
                      className={cn(
                        "border-b transition-colors hover:bg-muted/50",
                        index % 2 !== 0 && "bg-muted/30",
                      )}
                    >
                      <td className="p-3 align-middle font-mono text-xs text-muted-foreground/60">
                        {index + 1}
                      </td>
                      <td className="p-3 align-middle" style={{ maxWidth: 250 }}>
                        <TruncatedCell value={row.input} />
                      </td>
                      <td className="p-3 align-middle" style={{ maxWidth: 250 }}>
                        <TruncatedCell value={row.expectedOutput} />
                      </td>
                      {runs.map((run) => {
                        const score = row.scoresByRunId[run.id] ?? null
                        return (
                          <td key={run.id} className="p-3 align-middle">
                            <ScoreBadge
                              score={score}
                              highlight={
                                bestScore !== null && score === bestScore && scores.length > 1
                              }
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
