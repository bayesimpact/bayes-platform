import { Badge } from "@caseai-connect/ui/shad/badge"
import { useTranslation } from "react-i18next"
import type { EvaluationExtractionRunStatus } from "../evaluation-extraction-runs.models"

export function RunStatusBadge({ status }: { status: EvaluationExtractionRunStatus }) {
  const { t } = useTranslation()
  const variant =
    status === "completed"
      ? "success"
      : status === "failed"
        ? "destructive"
        : status === "running"
          ? "default"
          : status === "cancelled"
            ? "outline"
            : "secondary"
  return <Badge variant={variant}>{t(`evaluationExtractionRun:results.${status}`)}</Badge>
}
