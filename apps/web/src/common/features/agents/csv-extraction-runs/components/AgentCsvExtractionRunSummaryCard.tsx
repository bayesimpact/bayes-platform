import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@caseai-connect/ui/shad/card"
import { Spinner } from "@caseai-connect/ui/shad/spinner"
import { useTranslation } from "react-i18next"
import type { AgentCsvExtractionRun } from "../agent-csv-extraction-runs.models"

export function AgentCsvExtractionRunSummary({ run }: { run: AgentCsvExtractionRun }) {
  const { t } = useTranslation()

  if (!run.summary) return null

  const stats = [
    { label: t("agentCsvExtractionRun:results.total"), value: run.summary.total },
    { label: t("agentCsvExtractionRun:results.processed"), value: run.summary.processed },
    { label: t("agentCsvExtractionRun:results.errors"), value: run.summary.errors },
  ]

  const isRunning = run.status === "pending" || run.status === "running"

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle>{t("agentCsvExtractionRun:results.summary")}</CardTitle>
        <CardDescription>
          {isRunning && (
            <span className="flex items-center gap-1.5">
              <Spinner />
              {t("agentCsvExtractionRun:results.processing")}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
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
