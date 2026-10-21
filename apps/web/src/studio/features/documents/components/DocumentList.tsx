import { Alert, AlertDescription, AlertTitle } from "@caseai-connect/ui/shad/alert"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@caseai-connect/ui/shad/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@caseai-connect/ui/shad/dropdown-menu"
import { Item } from "@caseai-connect/ui/shad/item"
import {
  type ColumnDef,
  getCoreRowModel,
  type RowSelectionState,
  useReactTable,
} from "@tanstack/react-table"
import {
  ChevronRightIcon,
  CloudAlertIcon,
  EllipsisVerticalIcon,
  FileDownIcon,
  InfoIcon,
  Loader2Icon,
  PencilIcon,
  RotateCcwIcon,
  TagIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { DocumentDetailsSheet } from "@/common/components/DocumentSelectionList"
import { DataTable, type DataTableColumnMeta } from "@/common/components/data-table/DataTable"
import { DataTableBulkBar } from "@/common/components/data-table/DataTableBulkBar"
import { buildSelectionColumn } from "@/common/components/data-table/selection-column"
import { GridHeader } from "@/common/components/grid/Grid"
import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { buildSince } from "@/common/utils/build-date"
import { generateId } from "@/common/utils/generate-id"
import { getTagNameById } from "@/studio/features/document-tags/document-tags.helpers"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import { selectDocumentTagsData } from "@/studio/features/document-tags/document-tags.selectors"
import { DocumentEditForm } from "@/studio/features/documents/components/DocumentEditForm"
import { DocumentTagPicker } from "@/studio/features/documents/components/DocumentTagPicker"
import { EmbeddingStatusBadge } from "@/studio/features/documents/components/EmbeddingStatusBadge"
import { EmptyDocument } from "@/studio/features/documents/components/EmptyDocument"
import { UploadDocumentsButton } from "@/studio/features/documents/components/UploadDocumentsButton"
import type { Document } from "@/studio/features/documents/documents.models"
import {
  selectDocumentsData,
  selectUploaderState,
} from "@/studio/features/documents/documents.selectors"
import {
  addTagsToDocuments,
  deleteDocument,
  deleteDocuments,
  getDocumentTemporaryUrl,
  removeTagsFromDocuments,
  reprocessDocument,
} from "@/studio/features/documents/documents.thunks"
import { DocumentTagsSheet } from "../../document-tags/components/DocumentTagsSheet"

export function DocumentList() {
  // TanStack Table keeps one table instance across renders, so the React Compiler would
  // memoize its row model and show stale rows after a selection.
  "use no memo"
  const documents = useValue(selectDocumentsData)
  const documentTags = useValue(selectDocumentTagsData)

  const navigate = useNavigate()
  const { t } = useTranslation()
  const projectRoute = useGetProjectRoute()
  const handleBack = () => navigate(projectRoute)

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const columns = useMemo<ColumnDef<Document>[]>(
    () => [
      buildSelectionColumn<Document>({
        rowLabel: (document) => `${t("actions:select")} ${document.title}`,
      }),
      {
        id: "title",
        header: () => t("document:props.title"),
        cell: ({ row }) => row.original.title,
      },
      {
        id: "tags",
        header: () => t("document:props.tags"),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.tagIds.map((tagId) => (
              <Badge key={tagId} variant="secondary" className="text-xs">
                {getTagFullPath(documentTags, tagId)}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        id: "embeddingStatus",
        header: () => t("document:props.embeddingStatus"),
        cell: ({ row }) => <EmbeddingStatusBadge status={row.original.embeddingStatus} />,
      },
      {
        id: "updatedAt",
        header: () => t("document:props.updatedAt"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{buildSince(row.original.updatedAt)}</span>
        ),
      },
      {
        id: "actions",
        meta: { className: "w-10" } satisfies DataTableColumnMeta,
        header: () => null,
        cell: ({ row }) => <DocumentActions document={row.original} documentTags={documentTags} />,
      },
    ],
    [documentTags, t],
  )

  const table = useReactTable({
    data: documents,
    columns,
    state: { rowSelection },
    getRowId: (document) => document.id,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
  })

  const selectedDocuments = documents.filter((document) => rowSelection[document.id])
  const clearSelection = () => setRowSelection({})

  return (
    <UploadDocumentsButton className="w-full">
      <GridHeader
        onBack={handleBack}
        title={t("document:documents")}
        description={t("document:list.description")}
        action={
          <div className="flex items-center flex-wrap gap-2">
            <UploadDocumentsButton />
            <DocumentTagsSheet documentTags={documentTags} />
          </div>
        }
      />

      <div className="p-6 flex flex-col gap-6 bg-white">
        <UploaderStateComp />
        {documents.length === 0 ? (
          <EmptyDocument />
        ) : (
          <div className="flex flex-col gap-3">
            {selectedDocuments.length > 0 && (
              <DocumentBulkActions
                selectedDocuments={selectedDocuments}
                documentTags={documentTags}
                onClear={clearSelection}
              />
            )}
            <DataTable table={table} empty={null} />
          </div>
        )}
      </div>
    </UploadDocumentsButton>
  )
}

export function getTagFullPath(documentTags: DocumentTag[], tagId: string): React.ReactNode {
  const parts: string[] = []
  let currentId: string | undefined = tagId
  while (currentId) {
    const tag = documentTags.find((documentTag) => documentTag.id === currentId)
    if (!tag) break
    parts.unshift(tag.name)
    currentId = tag.parentId
  }
  return parts.length > 0
    ? parts.map((part, index) => (
        <div className="flex items-center select-none" key={generateId()}>
          <span className={index === parts.length - 1 ? "font-medium" : "text-muted-foreground"}>
            {part}
          </span>
          {index < parts.length - 1 && (
            <ChevronRightIcon className="size-3 ml-1 text-muted-foreground" />
          )}
        </div>
      ))
    : "Unknown Tag"
}

function DocumentBulkActions({
  selectedDocuments,
  documentTags,
  onClear,
}: {
  selectedDocuments: Document[]
  documentTags: DocumentTag[]
  onClear: () => void
}) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const [activeAction, setActiveAction] = useState<"delete" | "addTag" | "removeTag" | null>(null)

  const documentIds = selectedDocuments.map((document) => document.id)
  const count = documentIds.length
  const removableTagIds = [...new Set(selectedDocuments.flatMap((document) => document.tagIds))]

  const handleDelete = () => {
    dispatch(
      deleteDocuments({
        documentIds,
        onSuccess: () => {
          setActiveAction(null)
          onClear()
        },
      }),
    )
  }

  return (
    <>
      <DataTableBulkBar label={t("document:bulk.selected", { count })} onClearSelection={onClear}>
        <Button variant="outline" size="sm" onClick={() => setActiveAction("addTag")}>
          <TagIcon />
          {t("documentTag:addTag")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={removableTagIds.length === 0}
          onClick={() => setActiveAction("removeTag")}
        >
          <TagIcon />
          {t("document:bulk.removeTag.cta")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setActiveAction("delete")}>
          <Trash2Icon />
          {t("actions:delete")}
        </Button>
      </DataTableBulkBar>

      <ConfirmDialog
        open={activeAction === "delete"}
        title={t("document:bulk.delete.title", { count })}
        description={t("document:bulk.delete.description")}
        onConfirm={handleDelete}
        onCancel={() => setActiveAction(null)}
      />

      <BulkAddTagDialog
        open={activeAction === "addTag"}
        documentIds={documentIds}
        documentTags={documentTags}
        onSuccess={() => {
          setActiveAction(null)
          onClear()
        }}
        onCancel={() => setActiveAction(null)}
      />

      <BulkRemoveTagDialog
        open={activeAction === "removeTag"}
        documentIds={documentIds}
        documentTags={documentTags}
        removableTagIds={removableTagIds}
        onSuccess={() => {
          setActiveAction(null)
          onClear()
        }}
        onCancel={() => setActiveAction(null)}
      />
    </>
  )
}

function BulkAddTagDialog({
  open,
  documentIds,
  documentTags,
  onSuccess,
  onCancel,
}: {
  open: boolean
  documentIds: string[]
  documentTags: DocumentTag[]
  onSuccess: () => void
  onCancel: () => void
}) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const [tagIds, setTagIds] = useState<string[]>([])

  const handleApply = () => {
    dispatch(addTagsToDocuments({ documentIds, tagIds, onSuccess }))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setTagIds([])
          onCancel()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("document:bulk.addTag.title", { count: documentIds.length })}
          </DialogTitle>
          <DialogDescription>{t("document:bulk.addTag.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2 items-center">
          {tagIds.map((tagId) => (
            <Badge key={tagId} variant="secondary" className="gap-1">
              {getTagNameById(documentTags, tagId)}
              <button
                type="button"
                onClick={() => setTagIds((previous) => previous.filter((id) => id !== tagId))}
                className="opacity-60 hover:opacity-100"
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
          <DocumentTagPicker
            documentTags={documentTags}
            attachedTagIds={tagIds}
            onAdd={(tagId) => setTagIds((previous) => [...previous, tagId])}
          />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onCancel}>
            {t("actions:cancel")}
          </Button>
          <Button onClick={handleApply} disabled={tagIds.length === 0}>
            {t("document:bulk.addTag.confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function BulkRemoveTagDialog({
  open,
  documentIds,
  documentTags,
  removableTagIds,
  onSuccess,
  onCancel,
}: {
  open: boolean
  documentIds: string[]
  documentTags: DocumentTag[]
  removableTagIds: string[]
  onSuccess: () => void
  onCancel: () => void
}) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const [tagIds, setTagIds] = useState<string[]>([])

  const toggleTag = (tagId: string) => {
    setTagIds((previous) =>
      previous.includes(tagId) ? previous.filter((id) => id !== tagId) : [...previous, tagId],
    )
  }

  const handleRemove = () => {
    dispatch(removeTagsFromDocuments({ documentIds, tagIds, onSuccess }))
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setTagIds([])
          onCancel()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("document:bulk.removeTag.title", { count: documentIds.length })}
          </DialogTitle>
          <DialogDescription>{t("document:bulk.removeTag.description")}</DialogDescription>
        </DialogHeader>
        {removableTagIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("document:bulk.removeTag.empty")}</p>
        ) : (
          <div className="flex flex-wrap gap-2 items-center">
            {removableTagIds.map((tagId) => {
              const selected = tagIds.includes(tagId)
              return (
                <Badge
                  key={tagId}
                  asChild
                  variant={selected ? "destructive" : "secondary"}
                  className="cursor-pointer gap-1"
                >
                  <button type="button" onClick={() => toggleTag(tagId)}>
                    {getTagNameById(documentTags, tagId)}
                    {selected && <XIcon className="size-3" />}
                  </button>
                </Badge>
              )
            })}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onCancel}>
            {t("actions:cancel")}
          </Button>
          <Button variant="destructive" onClick={handleRemove} disabled={tagIds.length === 0}>
            {t("document:bulk.removeTag.confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DocumentActions({
  document,
  documentTags,
}: {
  document: Document
  documentTags: DocumentTag[]
}) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const [activeAction, setActiveAction] = useState<"delete" | "edit" | "details" | null>(null)

  const handleDownload = async () => {
    const result = await dispatch(getDocumentTemporaryUrl({ documentId: document.id })).unwrap()
    const anchor = window.document.createElement("a")
    anchor.href = result.url
    anchor.download = ""
    anchor.target = "_blank"
    anchor.click()
  }

  const handleDelete = () => {
    dispatch(
      deleteDocument({
        documentId: document.id,
        onSuccess: () => setActiveAction(null),
      }),
    )
  }

  const handleReprocess = () => {
    dispatch(reprocessDocument({ documentId: document.id }))
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <EllipsisVerticalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={handleDownload}>
            <FileDownIcon className="size-4" />
            {t("actions:downloadDocument")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActiveAction("details")}>
            <InfoIcon className="size-4" />
            {t("actions:view")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setActiveAction("edit")}>
            <PencilIcon className="size-4" />
            {t("actions:edit")}
          </DropdownMenuItem>
          {document.embeddingStatus === "failed" && (
            <DropdownMenuItem onSelect={handleReprocess}>
              <RotateCcwIcon className="size-4" />
              {t("document:reprocess.cta")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setActiveAction("delete")}>
            <Trash2Icon className="size-4" />
            {t("actions:delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={activeAction === "delete"}
        onOpenChange={(open) => !open && setActiveAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("document:delete.title", { documentTitle: document.title })}
            </DialogTitle>
            <DialogDescription className="wrap-anywhere">
              {t("document:delete.description", { name: document.title })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setActiveAction(null)}>
              {t("actions:cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t("actions:delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeAction === "edit"}
        onOpenChange={(open) => !open && setActiveAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("document:update.title", { documentTitle: document.title })}
            </DialogTitle>
          </DialogHeader>
          {activeAction === "edit" && (
            <DocumentEditForm document={document} onSuccess={() => setActiveAction(null)} />
          )}
        </DialogContent>
      </Dialog>

      <DocumentDetailsSheet
        document={document}
        documentTags={documentTags}
        open={activeAction === "details"}
        onOpenChange={(open) => !open && setActiveAction(null)}
      />
    </>
  )
}

function UploaderStateComp() {
  const { t } = useTranslation("document")
  const uploaderState = useAppSelector(selectUploaderState)
  return (
    <div className="flex flex-col gap-4 items-center justify-center">
      {uploaderState.status === "uploading" && (
        <Item variant="muted" className="w-full">
          <Loader2Icon className="animate-spin size-5" />
          <span className="text-sm">
            {t("uploading", {
              processed: uploaderState.processed,
              total: uploaderState.total,
            })}
          </span>
        </Item>
      )}

      {uploaderState.errors?.map((error, index) => (
        <Alert key={`${error.title.length}-${index}`} className="text-destructive">
          <CloudAlertIcon />
          <AlertTitle>{error.title}</AlertTitle>
          <AlertDescription>{error.description}</AlertDescription>
        </Alert>
      ))}
    </div>
  )
}
