import { GridCard } from "@/common/components/grid/Grid"
import { useAppSelector } from "@/common/store/hooks"
import { buildSince } from "@/common/utils/build-date"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import type { Document } from "@/studio/features/documents/documents.models"
import { selectCrawlProgressByDocumentId } from "@/studio/features/documents/documents.selectors"
import { CrawlingStatusBadge } from "./CrawlingStatusBadge"
import { DocumentDeletor } from "./DocumentDeletor"
import { DocumentDetailsSheet } from "./DocumentDetailsSheet"
import { DocumentEditor } from "./DocumentEditor"
import { DocumentOpener } from "./DocumentOpener"
import { EmbeddingStatusBadge } from "./EmbeddingStatusBadge"

export function DocumentItem({
  document,
  documentTags,
}: {
  document: Document
  documentTags: DocumentTag[]
}) {
  const date = buildSince(document.updatedAt)
  const pagesCrawled = useAppSelector(selectCrawlProgressByDocumentId)[document.id]

  return (
    <GridCard>
      <GridCard.TopAction>
        <div className="flex gap-1 items-center">
          <DocumentOpener noText documentId={document.id} />
          <DocumentDetailsSheet document={document} documentTags={documentTags} />
          <DocumentEditor document={document} />
          <DocumentDeletor document={document} />
        </div>
      </GridCard.TopAction>
      <GridCard.Badge>
        {document.sourceType === "webCrawl" ? (
          <CrawlingStatusBadge status={document.embeddingStatus} pagesCrawled={pagesCrawled} />
        ) : (
          <EmbeddingStatusBadge status={document.embeddingStatus} />
        )}
      </GridCard.Badge>
      <GridCard.Body>
        <GridCard.Title>{document.title}</GridCard.Title>
        <GridCard.Description>{date}</GridCard.Description>
      </GridCard.Body>
    </GridCard>
  )
}
