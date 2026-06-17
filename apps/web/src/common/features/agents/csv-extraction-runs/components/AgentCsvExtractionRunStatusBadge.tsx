import { Badge } from "@caseai-connect/ui/shad/badge"
import { useTranslation } from "react-i18next"
import type {
  AgentCsvExtractionRunRecordStatus,
  AgentCsvExtractionRunStatus,
} from "../agent-csv-extraction-runs.models"

export function AgentCsvExtractionRunStatusBadge({
  status,
}: {
  status: AgentCsvExtractionRunStatus
}) {
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
  return <Badge variant={variant}>{t(`agentCsvExtractionRun:results.${status}`)}</Badge>
}

export function RecordStatusBadge({ status }: { status: AgentCsvExtractionRunRecordStatus }) {
  const { t } = useTranslation()
  const variant =
    status === "success"
      ? "success"
      : status === "error"
        ? "destructive"
        : status === "cancelled"
          ? "outline"
          : "secondary"
  return <Badge variant={variant}>{t(`agentCsvExtractionRun:results.${status}`)}</Badge>
}
