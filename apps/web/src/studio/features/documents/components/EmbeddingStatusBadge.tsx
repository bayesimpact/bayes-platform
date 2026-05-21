import { Badge, type BadgeVariant } from "@caseai-connect/ui/shad/badge"
import { Loader2Icon } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { Document } from "@/studio/features/documents/documents.models"

type EmbeddingStatus = Document["embeddingStatus"]
type SourceType = Document["sourceType"]

const WEB_CRAWL_LABEL_KEY: Record<EmbeddingStatus, string> = {
  pending: "crawling",
  queued: "crawling",
  processing: "embedding",
  completed: "ready",
  failed: "failed",
}

const DEFAULT_LABEL_KEY: Record<EmbeddingStatus, string> = {
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

export function EmbeddingStatusBadge({
  status,
  sourceType,
  pagesCrawled,
}: {
  status: EmbeddingStatus
  sourceType?: SourceType
  pagesCrawled?: number
}) {
  const { t } = useTranslation("document", { keyPrefix: "props.embeddingStatuses" })
  const isCrawling = sourceType === "webCrawl" && (status === "pending" || status === "queued")
  const showSpinner = status === "pending" || status === "queued" || status === "processing"
  const label =
    isCrawling && typeof pagesCrawled === "number" && pagesCrawled > 0
      ? t("crawlingWithCount", { count: pagesCrawled })
      : t(sourceType === "webCrawl" ? WEB_CRAWL_LABEL_KEY[status] : DEFAULT_LABEL_KEY[status])

  return (
    <Badge variant={BADGE_VARIANT[status]} className="gap-1.5">
      {showSpinner && <Loader2Icon className="size-3 animate-spin" />}
      {label}
    </Badge>
  )
}
