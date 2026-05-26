import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@caseai-connect/ui/shad/card"
import { Spinner } from "@caseai-connect/ui/shad/spinner"
import { useTranslation } from "react-i18next"
import type { EvaluationExtractionRun } from "@/eval/features/evaluation-extraction-runs/evaluation-extraction-runs.models"

export function EvaluationExtractionRunSummary({ run }: { run: EvaluationExtractionRun }) {
  const { t } = useTranslation()

  if (!run.summary) return null

  const stats = [
    { label: t("evaluationExtractionRun:results.total"), value: run.summary.total },
    {
      label: t("evaluationExtractionRun:results.perfectMatches"),
      value: run.summary.perfectMatches,
    },
    { label: t("evaluationExtractionRun:results.mismatches"), value: run.summary.mismatches },
    { label: t("evaluationExtractionRun:results.errors"), value: run.summary.errors },
  ]

  const isRunning = run.status === "pending" || run.status === "running"
  const matchRate =
    run.summary.total > 0 ? Math.round((run.summary.perfectMatches / run.summary.total) * 100) : 0

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle>{t("evaluationExtractionRun:results.summary")}</CardTitle>
        <CardDescription>
          {isRunning ? (
            <span className="flex items-center gap-1.5">
              <Spinner />
              {t("evaluationExtractionRun:results.processing")}
            </span>
          ) : (
            t("evaluationExtractionRun:results.matchRate", { matchRate })
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1 rounded-lg border p-3">
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <span className="text-2xl font-bold">{stat.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
