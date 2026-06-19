import type { TimeType } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { Checkbox } from "@caseai-connect/ui/shad/checkbox"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@caseai-connect/ui/shad/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@caseai-connect/ui/shad/table"
import { ArrowRightIcon, InfoIcon, Trash2Icon, XIcon } from "lucide-react"
import { type ReactNode, useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { MarkdownWrapper } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/MarkdownWrapper"
import { buildDate, buildSince } from "@/common/utils/build-date"
import { formatBytes } from "@/common/utils/format-bytes"
import { DocumentTagItem } from "@/studio/features/document-tags/components/DocumentTagItem"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import { EmbeddingStatusBadge } from "@/studio/features/documents/components/EmbeddingStatusBadge"
import type { Document } from "@/studio/features/documents/documents.models"

export type DocumentSelectionItem = {
  id: string
  fileName?: string
  createdAt: TimeType
}

type Props<TDocument extends DocumentSelectionItem & DocumentDetails> = {
  documents: TDocument[]
  emptyState: ReactNode
  onSelect: (document: TDocument) => void
  onDelete: (documentIds: string[]) => void
}

type ActiveAction<TDocument> =
  | { type: "delete"; documentIds: string[] }
  | { type: "details"; document: TDocument }

/**
 * Presentational list of documents with a primary "select" action per row,
 * per-row details, plus single and bulk delete. Callers own data loading, the
 * empty state and the select/delete handlers — this component renders the
 * table, the bulk-action bar, the delete confirmation and the details sheet.
 */
export function DocumentSelectionList<TDocument extends DocumentSelectionItem & DocumentDetails>({
  documents,
  emptyState,
  onSelect,
  onDelete,
}: Props<TDocument>) {
  const { t } = useTranslation()
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [activeAction, setActiveAction] = useState<ActiveAction<TDocument> | null>(null)

  if (documents.length === 0) return <>{emptyState}</>

  const selectedCount = documents.filter((document) => selectedIds.has(document.id)).length
  const allSelected = selectedCount === documents.length
  const someSelected = selectedCount > 0 && !allSelected

  const clearSelection = () => setSelectedIds(new Set())

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(documents.map((document) => document.id)))
  }

  const toggleOne = (documentId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(documentId)) {
        next.delete(documentId)
      } else {
        next.add(documentId)
      }
      return next
    })
  }

  const handleConfirmDelete = () => {
    if (activeAction?.type === "delete") onDelete(activeAction.documentIds)
    setActiveAction(null)
    clearSelection()
  }

  return (
    <div className="flex flex-col gap-3">
      {selectedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
          <Button variant="ghost" size="icon" className="size-8" onClick={clearSelection}>
            <XIcon className="size-4" />
          </Button>
          <span className="text-sm font-medium">
            {t("documentList:selected", { count: selectedCount })}
          </span>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setActiveAction({
                  type: "delete",
                  documentIds: documents
                    .filter((document) => selectedIds.has(document.id))
                    .map((document) => document.id),
                })
              }
            >
              <Trash2Icon className="size-4" />
              {t("actions:delete")}
            </Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 rounded-tl-lg bg-muted">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={toggleAll}
                aria-label={t("actions:selectAll")}
              />
            </TableHead>
            <TableHead className="font-medium bg-muted">{t("documentList:props.name")}</TableHead>
            <TableHead className="font-medium bg-muted">
              {t("documentList:props.createdAt")}
            </TableHead>
            <TableHead className="w-10 bg-muted" />
            <TableHead className="w-60 rounded-tr-lg bg-muted" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((document) => {
            const selected = selectedIds.has(document.id)
            return (
              <TableRow key={document.id} data-state={selected ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={selected}
                    onCheckedChange={() => toggleOne(document.id)}
                    aria-label={t("actions:select")}
                  />
                </TableCell>
                <TableCell>{document.fileName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {buildSince(document.createdAt)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground"
                      aria-label={t("actions:view")}
                      onClick={() => setActiveAction({ type: "details", document })}
                    >
                      <InfoIcon className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      aria-label={t("actions:delete")}
                      onClick={() =>
                        setActiveAction({ type: "delete", documentIds: [document.id] })
                      }
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" onClick={() => onSelect(document)}>
                      {t("actions:select")} <ArrowRightIcon className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={activeAction?.type === "delete"}
        title={t("documentList:delete.title", {
          count: activeAction?.type === "delete" ? activeAction.documentIds.length : 0,
        })}
        description={t("documentList:delete.description")}
        onConfirm={handleConfirmDelete}
        onCancel={() => setActiveAction(null)}
      />

      {activeAction?.type === "details" && (
        <DocumentDetailsSheet
          document={activeAction.document}
          open
          onOpenChange={(open) => !open && setActiveAction(null)}
        />
      )}
    </div>
  )
}

/**
 * The fields the details sheet renders. The metadata is always present, while
 * embedding/tag/content data is optional so the sheet works for both full
 * documents and lighter models that only carry file metadata.
 */
type DocumentDetails = Pick<
  Document,
  "title" | "fileName" | "createdAt" | "updatedAt" | "size" | "language" | "mimeType" | "sourceType"
> &
  Partial<Pick<Document, "embeddingStatus" | "embeddingError" | "content" | "tagIds">>

export function DocumentDetailsSheet({
  document,
  documentTags = [],
  open,
  onOpenChange,
}: {
  document: DocumentDetails
  documentTags?: DocumentTag[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const hasEmbeddingInfo = ["project", "webCrawl"].includes(document.sourceType)
  const { t } = useTranslation()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{document.title}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <div className="flex flex-col gap-4">
            <MetaField
              label={t("document:props.createdAt")}
              value={buildDate(document.createdAt)}
            />

            <MetaField
              label={t("document:props.updatedAt")}
              value={buildDate(document.updatedAt)}
            />

            <MetaField label={t("document:props.fileName")} value={document.fileName} />

            <MetaField
              label={t("document:props.size")}
              value={document.size != null ? formatBytes(document.size) : undefined}
            />

            <MetaField label={t("document:props.language")} value={document.language} />

            <MetaField label={t("document:props.mimeType")} value={document.mimeType} />

            {hasEmbeddingInfo && document.embeddingStatus && (
              <div className="flex flex-col gap-1">
                <span className="font-medium">{t("document:props.embeddingStatus")}:</span>
                <EmbeddingStatusBadge status={document.embeddingStatus} />
              </div>
            )}

            {hasEmbeddingInfo && document.embeddingError && (
              <MetaField
                label={t("document:props.embeddingError")}
                value={document.embeddingError}
              />
            )}
          </div>
          {document.tagIds && document.tagIds.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t("document:props.tags")}</span>
              {document.tagIds.map((tagId) => {
                const tag = documentTags.find((documentTag) => documentTag.id === tagId)
                if (!tag) return null
                return <DocumentTagItem key={tagId} tag={tag} readonly />
              })}
            </div>
          )}
          {document.content && <MarkdownWrapper content={document.content} />}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function MetaField({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-1">
      <span className="font-medium">{label}:</span>
      <span className="text-muted-foreground">{value}</span>
    </div>
  )
}
