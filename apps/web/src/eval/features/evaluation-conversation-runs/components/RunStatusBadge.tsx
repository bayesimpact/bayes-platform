import { Badge } from "@caseai-connect/ui/shad/badge"
import { useTranslation } from "react-i18next"
import type { EvaluationConversationRunStatus } from "../evaluation-conversation-runs.models"

export function RunStatusBadge({ status }: { status: EvaluationConversationRunStatus }) {
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
  return <Badge variant={variant}>{t(`evaluationConversationRun:results.${status}`)}</Badge>
}
