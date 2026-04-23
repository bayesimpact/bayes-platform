import { Alert, AlertDescription, AlertTitle } from "@caseai-connect/ui/shad/alert"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { Collapsible, CollapsibleTrigger } from "@caseai-connect/ui/shad/collapsible"
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
import { Field, FieldGroup, FieldLabel, FieldSet } from "@caseai-connect/ui/shad/field"
import { Input } from "@caseai-connect/ui/shad/input"
import { Item } from "@caseai-connect/ui/shad/item"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@caseai-connect/ui/shad/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@caseai-connect/ui/shad/table"
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CloudAlertIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  FileDownIcon,
  GlobeIcon,
  InfoIcon,
  Loader2Icon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { useEffect, useReducer, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { MarkdownWrapper } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/MarkdownWrapper"
import { useGetPath } from "@/common/hooks/use-build-path"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { buildDate, buildSince } from "@/common/utils/build-date"
import { generateId } from "@/common/utils/generate-id"
import {
  getTagNameById,
  useDocumentTags,
} from "@/studio/features/document-tags/document-tags.helpers"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import { selectDocumentTagsData } from "@/studio/features/document-tags/document-tags.selectors"
import { CrawlUrlButton } from "@/studio/features/documents/components/CrawlUrlButton"
import { DocumentTagPicker } from "@/studio/features/documents/components/DocumentTagPicker"
import { EmbeddingStatusBadge } from "@/studio/features/documents/components/EmbeddingStatusBadge"
import { EmptyDocument } from "@/studio/features/documents/components/EmptyDocument"
import { UploadDocumentsButton } from "@/studio/features/documents/components/UploadDocumentsButton"
import type { Document } from "@/studio/features/documents/documents.models"
import {
  selectCrawlProgressByDocumentId,
  selectDocumentsData,
  selectUploaderState,
} from "@/studio/features/documents/documents.selectors"
import { documentsActions } from "@/studio/features/documents/documents.slice"
import {
  deleteDocument,
  getDocumentTemporaryUrl,
  reprocessDocument,
  updateDocument,
} from "@/studio/features/documents/documents.thunks"
import { AsyncRoute } from "../../common/routes/AsyncRoute"
import { DocumentTagItem } from "../features/document-tags/components/DocumentTagItem"
import { DocumentTagsSheet } from "../features/document-tags/components/DocumentTagsSheet"

export function DocumentsRoute() {
  useDocumentEmbeddingStatusStream()
  const documents = useAppSelector(selectDocumentsData)
  const documentTags = useAppSelector(selectDocumentTagsData)
  return (
    <AsyncRoute data={[documents, documentTags]}>
      {([documentsValue, documentTagsValue]) => (
        <WithData documents={documentsValue} documentTags={documentTagsValue} />
      )}
    </AsyncRoute>
  )
}

function WithData({
  documents,
  documentTags,
}: {
  documents: Document[]
  documentTags: DocumentTag[]
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { getPath } = useGetPath()
  const handleBack = () => {
    const path = getPath("project")
    navigate(path)
  }

  return (
    <UploadDocumentsButton className="w-full">
      <GridHeader
        onBack={handleBack}
        title={t("document:documents")}
        description={t("document:list.description")}
        action={
          <div className="flex items-center gap-2">
            <CrawlUrlButton />
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-medium rounded-tl-lg bg-muted">
                  {t("document:props.title")}
                </TableHead>
                <TableHead className="font-medium bg-muted">{t("document:props.tags")}</TableHead>
                <TableHead className="font-medium bg-muted">
                  {t("document:props.embeddingStatus")}
                </TableHead>
                <TableHead className="font-medium bg-muted">
                  {t("document:props.updatedAt")}
                </TableHead>
                <TableHead className="w-10 rounded-tr-lg bg-muted" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((document) => (
                <DocumentRow key={document.id} document={document} documentTags={documentTags} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </UploadDocumentsButton>
  )
}

function parseCrawledPages(content?: string): { url: string; markdown: string }[] | null {
  if (!content) return null
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].url && parsed[0].markdown) {
      return parsed
    }
  } catch {
    // not JSON, not a crawl document
  }
  return null
}

function DocumentRow({
  document,
  documentTags,
}: {
  document: Document
  documentTags: DocumentTag[]
}) {
  const date = buildSince(document.updatedAt)
  const isWebCrawl = document.sourceType === "webCrawl"
  const crawledPages = isWebCrawl ? parseCrawledPages(document.content) : null
  const hasPages = crawledPages && crawledPages.length > 0
  const pagesCrawled = useAppSelector(selectCrawlProgressByDocumentId)[document.id]

  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-2">
            {hasPages ? (
              <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-6 shrink-0">
                    {isOpen ? (
                      <ChevronDownIcon className="size-4" />
                    ) : (
                      <ChevronRightIcon className="size-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
            ) : null}
            <div className="flex items-center gap-1.5">
              {isWebCrawl ? <GlobeIcon className="size-4 text-muted-foreground shrink-0" /> : null}
              <span className="truncate">{document.title}</span>
              {hasPages ? (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {crawledPages.length} pages
                </Badge>
              ) : null}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {document.tagIds.map((tagId) => (
              <Badge key={tagId} variant="secondary" className="text-xs">
                {getTagFullPath(documentTags, tagId)}
              </Badge>
            ))}
          </div>
        </TableCell>
        <TableCell>
          <EmbeddingStatusBadge
            status={document.embeddingStatus}
            sourceType={document.sourceType}
            pagesCrawled={pagesCrawled}
          />
        </TableCell>
        <TableCell className="text-muted-foreground">{date}</TableCell>
        <TableCell>
          <DocumentActions document={document} documentTags={documentTags} />
        </TableCell>
      </TableRow>
      {crawledPages && isOpen
        ? crawledPages.map((page) => (
            <TableRow key={page.url} className="bg-muted/30">
              <TableCell colSpan={5} className="pl-16">
                <a
                  href={page.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLinkIcon className="size-3.5 shrink-0" />
                  <span className="truncate">{page.url}</span>
                </a>
              </TableCell>
            </TableRow>
          ))
        : null}
    </>
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
              <MetaField
                label={t("document:props.createdAt")}
                value={buildDate(document.createdAt)}
              />
              <MetaField
                label={t("document:props.updatedAt")}
                value={buildDate(document.updatedAt)}
              />
              <MetaField label={t("document:props.fileName")} value={document.fileName} />
              <MetaField label={t("document:props.size")} value={document.size?.toString()} />
              <MetaField label={t("document:props.language")} value={document.language} />
              <MetaField label={t("document:props.mimeType")} value={document.mimeType} />
              <div className="flex flex-col gap-1">
                <span className="font-medium">{t("document:props.embeddingStatus")}:</span>
                <EmbeddingStatusBadge
                  status={document.embeddingStatus}
                  sourceType={document.sourceType}
                  pagesCrawled={pagesCrawled}
                />
              </div>
              {document.embeddingError && (
                <MetaField
                  label={t("document:props.embeddingError")}
                  value={document.embeddingError}
                />
              )}
            </div>
            {document.tagIds.length > 0 && (
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

type EditorAction =
  | { type: "SET_TITLE"; title: string }
  | { type: "ADD_TAG"; tagId: string }
  | { type: "REMOVE_TAG"; tagId: string }

type EditorState = { title: string; tagIds: string[] }

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_TITLE":
      return { ...state, title: action.title }
    case "ADD_TAG":
      return { ...state, tagIds: [...state.tagIds, action.tagId] }
    case "REMOVE_TAG":
      return {
        ...state,
        tagIds: state.tagIds.filter((id) => id !== action.tagId),
      }
  }
}

function DocumentEditForm({ document, onSuccess }: { document: Document; onSuccess: () => void }) {
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const { documentTags } = useDocumentTags()

  const [editorState, dispatchEditor] = useReducer(editorReducer, {
    title: document.title,
    tagIds: document.tagIds,
  })

  const handleSave = () => {
    const originalTagIds = document.tagIds
    const tagsToAdd = editorState.tagIds.filter((tagId) => !originalTagIds.includes(tagId))
    const tagsToRemove = originalTagIds.filter((tagId) => !editorState.tagIds.includes(tagId))
    dispatch(
      updateDocument({
        documentId: document.id,
        fields: { title: editorState.title, tagsToAdd, tagsToRemove },
        onSuccess,
      }),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <FieldGroup>
        <FieldSet>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="doc-title">{t("document:props.title")}</FieldLabel>
              <Input
                id="doc-title"
                value={editorState.title}
                onChange={(event) =>
                  dispatchEditor({
                    type: "SET_TITLE",
                    title: event.target.value,
                  })
                }
              />
            </Field>
          </FieldGroup>
        </FieldSet>
      </FieldGroup>

      <div className="flex flex-col gap-2">
        <FieldLabel>{t("document:props.tags")}</FieldLabel>
        <div className="flex flex-wrap gap-2 items-center">
          {editorState.tagIds.map((tagId) => (
            <Badge key={tagId} variant="secondary" className="gap-1">
              {getTagNameById(documentTags, tagId)}
              <button
                type="button"
                onClick={() => dispatchEditor({ type: "REMOVE_TAG", tagId })}
                className="opacity-60 hover:opacity-100"
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
          <DocumentTagPicker
            documentTags={documentTags}
            attachedTagIds={editorState.tagIds}
            onAdd={(tagId) => dispatchEditor({ type: "ADD_TAG", tagId })}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave}>{t("actions:update")}</Button>
      </div>
    </div>
  )
}

function MetaField({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-1">
      <span className="font-medium">{label}:</span>
      <span className="text-muted-foreground">{value}</span>
    </div>
  )
}

function useDocumentEmbeddingStatusStream() {
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(documentsActions.startEmbeddingStatusStream())
    dispatch(documentsActions.startCrawlProgressStream())
    return () => {
      dispatch(documentsActions.stopEmbeddingStatusStream())
      dispatch(documentsActions.stopCrawlProgressStream())
    }
  }, [dispatch])
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
