import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@caseai-connect/ui/shad/card"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { buildSince } from "@/common/utils/build-date"
import type { EvaluationExtractionRun } from "@/eval/features/evaluation-extraction-runs/evaluation-extraction-runs.models"
import { useEvaluationExtractionRunPath } from "@/eval/hooks/use-evaluation-extraction-run-path"
import { AgentMetadataDialog } from "./AgentMetadataDialog"
import { DeleteEvaluationExtractionRunButton } from "./DeleteEvaluationExtractionRunButton"
import { RunStatusBadge } from "./RunStatusBadge"

export function EvaluationExtractionRunHistory({ runs }: { runs: EvaluationExtractionRun[] }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { buildRunPath } = useEvaluationExtractionRunPath()

  if (runs.length === 0) return null

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle>{t("evaluationExtractionRun:history.title")}</CardTitle>
        <CardDescription>
          {t("evaluationExtractionRun:history.description", { count: runs.length })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border">
          {runs.map((run, index) => {
            const matchRate =
              run.summary && run.summary.total > 0
                ? Math.round((run.summary.perfectMatches / run.summary.total) * 100)
                : null

            return (
              <div
                key={run.id}
                className={`flex w-full items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors ${index > 0 ? "border-t" : ""}`}
              >
                <button
                  type="button"
                  className="flex flex-1 items-center gap-3 text-left"
                  onClick={() => navigate(buildRunPath({ runId: run.id }))}
                >
                  <div className="flex items-center gap-3">
                    <RunStatusBadge status={run.status} />
                    <span className="text-sm text-muted-foreground">
                      {buildSince(run.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {matchRate !== null && (
                      <span className="text-sm font-medium">
                        {t("evaluationExtractionRun:history.matchRate", { matchRate })}
                      </span>
                    )}
                    {run.summary && (
                      <span className="text-xs text-muted-foreground">
                        {t("evaluationExtractionRun:history.recordCount", {
                          count: run.summary.total,
                        })}
                      </span>
                    )}
                  </div>
                </button>

                <div className="flex items-center gap-2">
                  <AgentMetadataDialog agentId={run.agentId} />
                  <DeleteEvaluationExtractionRunButton
                    buttonProps={{ variant: "outline", size: "sm" }}
                    runId={run.id}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
