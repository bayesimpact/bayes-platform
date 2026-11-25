import { Badge, type BadgeVariant } from "@bayes-platform/ui/shad/badge"
import { Loader2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { Document } from "@/studio/features/documents/documents.models"

type EmbeddingStatus = Document["embeddingStatus"]

const LABEL_KEY: Record<EmbeddingStatus, string> = {
  pending: "processing",
  queued: "processing",
  processing: "processing",
  completed: "completed",
  failed: "failed",
}

const BADGE_VARIANT: Record<EmbeddingStatus, BadgeVariant> = {
  pending: "outline",
  queued: "outline",
  processing: "outline",
  completed: "success",
  failed: "destructive",
}

export function EmbeddingStatusBadge({ status }: { status: EmbeddingStatus }) {
  const { t } = useTranslation("document", { keyPrefix: "props.embeddingStatuses" })
  const showSpinner = status === "pending" || status === "queued" || status === "processing"

  return (
    <Badge variant={BADGE_VARIANT[status]} className="gap-1.5">
      {showSpinner && <Loader2Icon className="size-3 animate-spin" />}
      {t(LABEL_KEY[status])}
    </Badge>
  )
}
