import type { TimeType } from "@caseai-connect/api-contracts"
import { Button } from "@caseai-connect/ui/shad/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@caseai-connect/ui/shad/sheet"
import {
  type ColumnDef,
  getCoreRowModel,
  type RowSelectionState,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowRightIcon, InfoIcon, Trash2Icon } from "lucide-react"
import { type ReactNode, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { DataTable, type DataTableColumnMeta } from "@/common/components/data-table/DataTable"
import { DataTableBulkBar } from "@/common/components/data-table/DataTableBulkBar"
import { buildSelectionColumn } from "@/common/components/data-table/selection-column"
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
  // TanStack Table keeps one table instance across renders, so the React Compiler would
  // memoize its row model and show stale rows after a selection.
  "use no memo"
  const { t } = useTranslation()
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [activeAction, setActiveAction] = useState<ActiveAction<TDocument> | null>(null)

  const columns = useMemo<ColumnDef<TDocument>[]>(
    () => [
      buildSelectionColumn<TDocument>({
        rowLabel: (document) => `${t("actions:select")} ${document.fileName ?? ""}`.trim(),
      }),
      {
        id: "name",
        header: () => t("documentList:props.name"),
        cell: ({ row }) => row.original.fileName,
      },
      {
        id: "createdAt",
        header: () => t("documentList:props.createdAt"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{buildSince(row.original.createdAt)}</span>
        ),
      },
      {
        id: "actions",
        meta: { className: "w-10" } satisfies DataTableColumnMeta,
        header: () => null,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground"
              aria-label={t("actions:view")}
              onClick={() => setActiveAction({ type: "details", document: row.original })}
            >
              <InfoIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              aria-label={t("actions:delete")}
              onClick={() => setActiveAction({ type: "delete", documentIds: [row.original.id] })}
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>
        ),
      },
      {
        id: "select-document",
        meta: { className: "w-60" } satisfies DataTableColumnMeta,
        header: () => null,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => onSelect(row.original)}>
              {t("actions:select")} <ArrowRightIcon className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [onSelect, t],
  )

  const table = useReactTable({
    data: documents,
    columns,
    state: { rowSelection },
    getRowId: (document) => document.id,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
  })

  if (documents.length === 0) return <>{emptyState}</>

  const selectedIds = documents
    .filter((document) => rowSelection[document.id])
    .map((document) => document.id)

  const clearSelection = () => setRowSelection({})

  const handleConfirmDelete = () => {
    if (activeAction?.type === "delete") onDelete(activeAction.documentIds)
    setActiveAction(null)
    clearSelection()
  }

  return (
    <div className="flex flex-col gap-3">
      {selectedIds.length > 0 && (
        <DataTableBulkBar
          label={t("documentList:selected", { count: selectedIds.length })}
          onClearSelection={clearSelection}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveAction({ type: "delete", documentIds: selectedIds })}
          >
            <Trash2Icon />
            {t("actions:delete")}
          </Button>
        </DataTableBulkBar>
      )}

      <DataTable table={table} empty={null} />

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
  "fileName" | "createdAt" | "updatedAt" | "size" | "mimeType"
> &
  Partial<
    Pick<
      Document,
      | "title"
      | "language"
      | "sourceType"
      | "embeddingStatus"
      | "embeddingError"
      | "content"
      | "tagIds"
    >
  >

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
  const hasEmbeddingInfo =
    document.sourceType !== undefined && ["project", "webCrawl"].includes(document.sourceType)
  const { t } = useTranslation()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{document.title ?? document.fileName}</SheetTitle>
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
