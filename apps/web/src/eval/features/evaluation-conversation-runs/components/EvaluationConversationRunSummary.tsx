import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@caseai-connect/ui/shad/card"
import { Spinner } from "@caseai-connect/ui/shad/spinner"
import { useTranslation } from "react-i18next"
import type { EvaluationConversationRun } from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.models"

export function EvaluationConversationRunSummary({ run }: { run: EvaluationConversationRun }) {
  const { t } = useTranslation()

  if (!run.summary) return null

  const averageScore =
    run.summary.averageScore !== null ? Math.round(run.summary.averageScore * 10) / 10 : null

  const stats = [
    { label: t("evaluationConversationRun:results.total"), value: run.summary.total },
    { label: t("evaluationConversationRun:results.gradedCount"), value: run.summary.graded },
    { label: t("evaluationConversationRun:results.errors"), value: run.summary.errors },
    {
      label: t("evaluationConversationRun:results.averageScore"),
      value: averageScore !== null ? `${averageScore}/5` : "-",
    },
  ]

  const isRunning = run.status === "pending" || run.status === "running"

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle>{t("evaluationConversationRun:results.summary")}</CardTitle>
        <CardDescription>
          {isRunning ? (
            <span className="flex items-center gap-1.5">
              <Spinner />
              {t("evaluationConversationRun:results.processing")}
            </span>
          ) : averageScore !== null ? (
            t("evaluationConversationRun:results.averageScoreDescription", { averageScore })
          ) : (
            t("evaluationConversationRun:results.noScore")
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
