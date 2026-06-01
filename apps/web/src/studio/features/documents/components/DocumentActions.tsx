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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@caseai-connect/ui/shad/sheet"
import {
  EllipsisVerticalIcon,
  FileDownIcon,
  InfoIcon,
  PencilIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { MarkdownWrapper } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/MarkdownWrapper"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { buildDate } from "@/common/utils/build-date"
import { DocumentTagItem } from "@/studio/features/document-tags/components/DocumentTagItem"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import { CrawlingStatusBadge } from "@/studio/features/documents/components/CrawlingStatusBadge"
import { EmbeddingStatusBadge } from "@/studio/features/documents/components/EmbeddingStatusBadge"
import type { Document } from "@/studio/features/documents/documents.models"
import { selectCrawlProgressByDocumentId } from "@/studio/features/documents/documents.selectors"
import {
  deleteDocument,
  getDocumentTemporaryUrl,
  reCrawlUrl,
  reprocessDocument,
} from "@/studio/features/documents/documents.thunks"
import { DocumentEditForm, DocumentMetaField } from "./DocumentEditDialog"

export function FileDocumentActions({
  document,
  documentTags,
}: {
  document: Document
  documentTags: DocumentTag[]
}) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const [activeAction, setActiveAction] = useState<"delete" | "edit" | "details" | null>(null)
  const pagesCrawled = useAppSelector(selectCrawlProgressByDocumentId)[document.id]

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

      <DocumentDialogs
        document={document}
        documentTags={documentTags}
        pagesCrawled={pagesCrawled}
        activeAction={activeAction}
        setActiveAction={setActiveAction}
        onDelete={handleDelete}
      />
    </>
  )
}

export function WebSourceDocumentActions({
  document,
  documentTags,
}: {
  document: Document
  documentTags: DocumentTag[]
}) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const [activeAction, setActiveAction] = useState<"delete" | "edit" | "details" | null>(null)
  const pagesCrawled = useAppSelector(selectCrawlProgressByDocumentId)[document.id]

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

  const handleReCrawl = () => {
    dispatch(reCrawlUrl({ documentId: document.id }))
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
          <DropdownMenuItem onSelect={handleReCrawl}>
            <RefreshCwIcon className="size-4" />
            {t("document:recrawl")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setActiveAction("delete")}>
            <Trash2Icon className="size-4" />
            {t("actions:delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DocumentDialogs
        document={document}
        documentTags={documentTags}
        pagesCrawled={pagesCrawled}
        activeAction={activeAction}
        setActiveAction={setActiveAction}
        onDelete={handleDelete}
      />
    </>
  )
}

function DocumentDialogs({
  document,
  documentTags,
  pagesCrawled,
  activeAction,
  setActiveAction,
  onDelete,
}: {
  document: Document
  documentTags: DocumentTag[]
  pagesCrawled: number | undefined
  activeAction: "delete" | "edit" | "details" | null
  setActiveAction: (action: "delete" | "edit" | "details" | null) => void
  onDelete: () => void
}) {
  const { t } = useTranslation()

  return (
    <>
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
            <Button variant="destructive" onClick={onDelete}>
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

      <Sheet
        open={activeAction === "details"}
        onOpenChange={(open) => !open && setActiveAction(null)}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{document.title}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <div className="flex flex-col gap-4">
              <DocumentMetaField
                label={t("document:props.createdAt")}
                value={buildDate(document.createdAt)}
              />
              <DocumentMetaField
                label={t("document:props.updatedAt")}
                value={buildDate(document.updatedAt)}
              />
              <DocumentMetaField label={t("document:props.fileName")} value={document.fileName} />
              <DocumentMetaField
                label={t("document:props.size")}
                value={document.size?.toString()}
              />
              <DocumentMetaField label={t("document:props.language")} value={document.language} />
              <DocumentMetaField label={t("document:props.mimeType")} value={document.mimeType} />
              <div className="flex flex-col gap-1">
                <span className="font-medium">{t("document:props.embeddingStatus")}:</span>
                {document.sourceType === "webCrawl" ? (
                  <CrawlingStatusBadge
                    status={document.embeddingStatus}
                    pagesCrawled={pagesCrawled}
                  />
                ) : (
                  <EmbeddingStatusBadge status={document.embeddingStatus} />
                )}
              </div>
              {document.embeddingError && (
                <DocumentMetaField
                  label={t("document:props.embeddingError")}
                  value={document.embeddingError}
                />
              )}
            </div>
            {documentTags.length > 0 && document.tagIds.length > 0 && (
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
    </>
  )
}
