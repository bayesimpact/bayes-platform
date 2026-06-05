import { Button } from "@caseai-connect/ui/shad/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@caseai-connect/ui/shad/card"
import { cn } from "@caseai-connect/ui/utils"
import { ArrowRightIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { buildSince } from "@/common/utils/build-date"
import type { EvaluationExtractionRun } from "@/eval/features/evaluation-extraction-runs/evaluation-extraction-runs.models"
import { useEvaluationExtractionRunPath } from "@/eval/hooks/use-evaluation-extraction-run-path"
import { DocumentOpener } from "@/studio/features/documents/components/DocumentOpener"
import { AgentMetadataDialog } from "./AgentMetadataDialog"
import { DeleteEvaluationExtractionRunButton } from "./DeleteEvaluationExtractionRunButton"
import { RunStatusBadge } from "./RunStatusBadge"

export function EvaluationExtractionRunHistory({ runs }: { runs: EvaluationExtractionRun[] }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { buildRunPath } = useEvaluationExtractionRunPath()

  const handleOpen = (runId: string) => {
    navigate(buildRunPath({ runId }))
  }

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
          {runs.map((run, index) => (
            <RunItem
              key={run.id}
              run={run}
              isFirst={index === 0}
              onOpen={() => handleOpen(run.id)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function RunItem({
  run,
  isFirst,
  onOpen,
}: {
  run: EvaluationExtractionRun
  isFirst: boolean
  onOpen: () => void
}) {
  const { t } = useTranslation()

  const matchRate =
    run.summary && run.summary.total > 0
      ? Math.round((run.summary.perfectMatches / run.summary.total) * 100)
      : null

  return (
    <div
      className={cn(
        "flex w-full items-center justify-between px-4 py-3 gap-6 hover:bg-muted/50 transition-colors",
        { "border-t": !isFirst },
      )}
    >
      <button
        type="button"
        className="flex flex-1 items-center gap-3 text-left flex-wrap"
        onClick={onOpen}
      >
        <div className="flex items-center gap-3">
          <RunStatusBadge status={run.status} />
          <span className="text-sm text-muted-foreground">{buildSince(run.updatedAt)}</span>
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

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 flex-wrap">
          {run.csvExportDocumentId && (
            <DocumentOpener buttonProps={{ size: "sm" }} documentId={run.csvExportDocumentId} />
          )}
          <AgentMetadataDialog
            buttonProps={{ variant: "secondary", size: "sm" }}
            agentId={run.agentId}
          />
          <DeleteEvaluationExtractionRunButton
            buttonProps={{ variant: "secondary", size: "icon-sm" }}
            runId={run.id}
          />
        </div>

        <Button onClick={onOpen} size="icon-sm">
          <ArrowRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
