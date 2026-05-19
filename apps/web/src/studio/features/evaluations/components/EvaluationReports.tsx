import { useTranslation } from "react-i18next"
import type z from "zod"
import { Loader } from "@/common/components/Loader"
import type { Agent } from "@/common/features/agents/agents.models"
import { ADS } from "@/common/store/async-data-status"
import { useAppSelector } from "@/common/store/hooks"
import type { EvaluationReport } from "@/studio/features/evaluation-reports/evaluation-reports.models"
import { selectEvaluationReportsForEvaluation } from "@/studio/features/evaluation-reports/evaluation-reports.selectors"
import { EvaluationReportTable } from "./table/EvaluationReportTable"
import type { schema } from "./table/schema"

export function EvaluationReports({
  evaluationId,
  agents,
}: {
  evaluationId: string
  agents: Agent[]
}) {
  const evaluationReports = useAppSelector(selectEvaluationReportsForEvaluation(evaluationId))

  if (ADS.isError(evaluationReports)) return <ErrorMessage />
  if (ADS.isFulfilled(evaluationReports)) {
    const data = buildData({ evaluationReports: evaluationReports.value, agents })
    const key = data.map((report) => report.id).join("-")
    return <EvaluationReportTable key={key} data={data} />
  }

  return <Loader />
}

function ErrorMessage() {
  const { t } = useTranslation()
  return <div className="text-red-500">{t("evaluation:failedToLoad")}</div>
}

function buildData({
  evaluationReports,
  agents,
}: {
  evaluationReports: EvaluationReport[]
  agents: Agent[]
}) {
  return evaluationReports
    .map((report) => {
      const agent = agents.find((agent) => agent.id === report.agentId)
      if (!agent) return null
      return {
        id: report.id,
        agent,
        status: report.output.trim().length === 0 ? "loading" : "done",
        output: report.output,
        score: report.score,
        createdAt: report.createdAt,
        traceUrl: report.traceUrl,
      } satisfies z.infer<typeof schema>
    })
    .filter((report) => report !== null) satisfies z.infer<typeof schema>[]
}
