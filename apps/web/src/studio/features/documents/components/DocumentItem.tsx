import { GridItem } from "@/common/components/grid/Grid"
import { buildSince } from "@/common/utils/build-date"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import type { Document } from "@/studio/features/documents/documents.models"
import { DocumentDeletor } from "./DocumentDeletor"
import { DocumentDetailsSheet } from "./DocumentDetailsSheet"
import { DocumentEditor } from "./DocumentEditor"
import { DocumentOpener } from "./DocumentOpener"
import { EmbeddingStatusBadge } from "./EmbeddingStatusBadge"

export function DocumentItem({
  document,
  documentTags,
  index,
}: {
  index: number
  document: Document
  documentTags: DocumentTag[]
}) {
  const date = buildSince(document.updatedAt)

  return (
    <GridItem
      index={index}
      badge={
        <EmbeddingStatusBadge status={document.embeddingStatus} sourceType={document.sourceType} />
      }
      title={<div className="wrap-anywhere">{document.title}</div>}
      description={date}
      action={
        <div className="flex gap-2 items-center">
          <DocumentOpener noText documentId={document.id} />
          <DocumentDetailsSheet document={document} documentTags={documentTags} />
          <DocumentEditor document={document} />
          <DocumentDeletor document={document} />
        </div>
      }
    />
  )
}
