import { Button } from "@caseai-connect/ui/shad/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@caseai-connect/ui/shad/sheet"
import { InfoIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { MarkdownWrapper } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/MarkdownWrapper"
import { useAppSelector } from "@/common/store/hooks"
import { buildDate } from "@/common/utils/build-date"
import { DocumentTagItem } from "@/studio/features/document-tags/components/DocumentTagItem"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import type { Document } from "@/studio/features/documents/documents.models"
import { selectCrawlProgressByDocumentId } from "@/studio/features/documents/documents.selectors"
import { EmbeddingStatusBadge } from "./EmbeddingStatusBadge"

export function DocumentDetailsSheet({
  document,
  documentTags,
}: {
  document: Document
  documentTags: DocumentTag[]
}) {
  const { t } = useTranslation("document", { keyPrefix: "props" })
  const pagesCrawled = useAppSelector(selectCrawlProgressByDocumentId)[document.id]
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon">
          <InfoIcon className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{document.title}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="flex flex-col gap-4">
            <MetaData label={t("createdAt")} value={buildDate(document.createdAt)} />
            <MetaData label={t("updatedAt")} value={buildDate(document.updatedAt)} />
            <MetaData label={t("fileName")} value={document.fileName} />
            <MetaData label={t("size")} value={document.size?.toString()} />
            <MetaData label={t("language")} value={document.language} />
            <MetaData label={t("mimeType")} value={document.mimeType} />
            <div className="flex flex-col gap-1">
              <span className="font-medium">{t("embeddingStatus")}:</span>
              <EmbeddingStatusBadge
                status={document.embeddingStatus}
                sourceType={document.sourceType}
                pagesCrawled={pagesCrawled}
              />
            </div>
            {document.embeddingError && (
              <MetaData label={t("embeddingError")} value={document.embeddingError} />
            )}
          </div>
          {document.tagIds.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t("tags")}</span>
              {document.tagIds.map((id) => {
                const tag = documentTags.find((tag) => tag.id === id)
                if (!tag) return null
                return <DocumentTagItem key={id} tag={tag} readonly />
              })}
            </div>
          )}
          {document.content && <MarkdownWrapper content={document.content} />}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function MetaData({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-1">
      <span className="font-medium">{label}:</span>
      <span className="text-muted-foreground">{value}</span>
    </div>
  )
}
