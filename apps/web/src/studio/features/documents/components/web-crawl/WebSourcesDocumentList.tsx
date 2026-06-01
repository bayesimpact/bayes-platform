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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@caseai-connect/ui/shad/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@caseai-connect/ui/shad/table"
import { cn } from "@caseai-connect/ui/utils"
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  FileDownIcon,
  GlobeIcon,
  InfoIcon,
  PencilIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { useReducer, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { MarkdownWrapper } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/MarkdownWrapper"
import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { buildDate, buildSince } from "@/common/utils/build-date"
import { generateId } from "@/common/utils/generate-id"
import { DocumentTagItem } from "@/studio/features/document-tags/components/DocumentTagItem"
import { DocumentTagsSheet } from "@/studio/features/document-tags/components/DocumentTagsSheet"
import {
  getTagNameById,
  useDocumentTags,
} from "@/studio/features/document-tags/document-tags.helpers"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import { selectDocumentTagsData } from "@/studio/features/document-tags/document-tags.selectors"
import { CrawlingStatusBadge } from "@/studio/features/documents/components/CrawlingStatusBadge"
import { CrawlUrlButton } from "@/studio/features/documents/components/CrawlUrlButton"
import { DocumentTagPicker } from "@/studio/features/documents/components/DocumentTagPicker"
import type { Document } from "@/studio/features/documents/documents.models"
import {
  selectCrawlProgressByDocumentId,
  selectDocumentsData,
} from "@/studio/features/documents/documents.selectors"
import {
  deleteDocument,
  getDocumentTemporaryUrl,
  reCrawlUrl,
  reprocessDocument,
  updateDocument,
} from "@/studio/features/documents/documents.thunks"

export function WebSourcesDocumentList() {
  const documents = useValue(selectDocumentsData)
  const documentTags = useValue(selectDocumentTagsData)
  const navigate = useNavigate()
  const { t } = useTranslation()

  const visibleDocuments = documents.filter((document) => document.sourceType === "webCrawl")

  const getProjectRoute = useGetProjectRoute()
  const handleBack = () => navigate(getProjectRoute)

  const hasDocuments = visibleDocuments.length > 0

  return (
    <div className="w-full">
      <GridHeader
        onBack={handleBack}
        title={t("document:documents")}
        description={t("document:list.description")}
        action={
          <div className="flex items-center gap-2">
            <CrawlUrlButton />

            <DocumentTagsSheet documentTags={documentTags} />
          </div>
        }
      />

      <div className={cn("flex flex-col gap-6 bg-white", hasDocuments && "p-6")}>
        {hasDocuments && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-medium rounded-tl-lg bg-muted">
                  {t("document:props.title")}
                </TableHead>
                <TableHead className="font-medium bg-muted">{t("document:props.pages")}</TableHead>
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
              {visibleDocuments.map((document) => (
                <DocumentRow key={document.id} document={document} documentTags={documentTags} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
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
  const hasPages = document.pages && document.pages.length > 0
  const pagesCrawled = useAppSelector(selectCrawlProgressByDocumentId)[document.id]

  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-2">
            {hasPages && (
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
            )}
            <div className="flex items-center gap-1.5">
              {isWebCrawl && <GlobeIcon className="size-4 text-muted-foreground shrink-0" />}
              <span className="truncate">{document.title}</span>
            </div>
          </div>
        </TableCell>

        <TableCell className="text-muted-foreground">
          {hasPages ? document.pages!.length : "—"}
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
          <CrawlingStatusBadge status={document.embeddingStatus} pagesCrawled={pagesCrawled} />
        </TableCell>
        <TableCell className="text-muted-foreground">{date}</TableCell>
        <TableCell>
          <DocumentActions document={document} documentTags={documentTags} />
        </TableCell>
      </TableRow>
      {document.pages && isOpen
        ? document.pages.map((page) => (
            <TableRow key={page.url} className="bg-muted/30">
              <TableCell colSpan={5} className="pl-16 max-w-0">
                <a
                  href={page.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={page.url}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors min-w-0"
                >
                  <ExternalLinkIcon className="size-3.5 shrink-0" />
                  <span className="block truncate min-w-0 flex-1">{page.url}</span>
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
          {document.sourceType !== "webCrawl" && (
            <DropdownMenuItem onSelect={handleDownload}>
              <FileDownIcon className="size-4" />
              {t("actions:downloadDocument")}
            </DropdownMenuItem>
          )}
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
          {document.sourceType === "webCrawl" && (
            <DropdownMenuItem onSelect={handleReCrawl}>
              <RefreshCwIcon className="size-4" />
              {t("document:recrawl")}
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
                <CrawlingStatusBadge
                  status={document.embeddingStatus}
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
