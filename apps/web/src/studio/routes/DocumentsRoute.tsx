import { Alert, AlertDescription, AlertTitle } from "@caseai-connect/ui/shad/alert"
import { Badge } from "@caseai-connect/ui/shad/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@caseai-connect/ui/shad/table"
import { ChevronRightIcon, CloudAlertIcon, Loader2Icon } from "lucide-react"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { buildSince } from "@/common/utils/build-date"
import { generateId } from "@/common/utils/generate-id"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import { selectDocumentTagsData } from "@/studio/features/document-tags/document-tags.selectors"
import { FileDocumentActions } from "@/studio/features/documents/components/DocumentActions"
import { EmbeddingStatusBadge } from "@/studio/features/documents/components/EmbeddingStatusBadge"
import { EmptyDocument } from "@/studio/features/documents/components/EmptyDocument"
import { UploadDocumentsButton } from "@/studio/features/documents/components/UploadDocumentsButton"
import type { Document } from "@/studio/features/documents/documents.models"
import {
  selectDocumentsData,
  selectUploaderState,
} from "@/studio/features/documents/documents.selectors"
import { documentsActions } from "@/studio/features/documents/documents.slice"
import { AsyncRoute } from "../../common/routes/AsyncRoute"
import { DocumentTagsSheet } from "../features/document-tags/components/DocumentTagsSheet"

export function DocumentsRoute() {
  useDocumentStreams()
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
  const getProjectRoute = useGetProjectRoute()
  const handleBack = () => navigate(getProjectRoute())

  const visibleDocuments = documents.filter((document) => document.sourceType === "project")

  return (
    <UploadDocumentsButton className="w-full">
      <GridHeader
        onBack={handleBack}
        title={t("document:documents")}
        description={t("document:list.description")}
        action={
          <div className="flex items-center gap-2">
            <UploadDocumentsButton />
            <DocumentTagsSheet documentTags={documentTags} />
          </div>
        }
      />

      <div className="p-6 flex flex-col gap-6 bg-white">
        <UploaderStateComp />
        {visibleDocuments.length === 0 ? (
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
              {visibleDocuments.map((document) => (
                <DocumentRow key={document.id} document={document} documentTags={documentTags} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </UploadDocumentsButton>
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

  return (
    <TableRow>
      <TableCell>
        <span className="truncate">{document.title}</span>
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
        <EmbeddingStatusBadge status={document.embeddingStatus} sourceType={document.sourceType} />
      </TableCell>
      <TableCell className="text-muted-foreground">{date}</TableCell>
      <TableCell>
        <FileDocumentActions document={document} documentTags={documentTags} />
      </TableCell>
    </TableRow>
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

function useDocumentStreams() {
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(documentsActions.setCurrentSourceType({ sourceType: "project" }))
    dispatch(documentsActions.startEmbeddingStatusStream())
    return () => {
      dispatch(documentsActions.setCurrentSourceType({ sourceType: null }))
      dispatch(documentsActions.stopEmbeddingStatusStream())
    }
  }, [dispatch])
}

function UploaderStateComp() {
  const { t } = useTranslation("document")
  const uploaderState = useAppSelector(selectUploaderState)
  return (
    <div className="flex flex-col gap-4 items-center justify-center">
      {uploaderState.status === "uploading" && (
        <div className="flex items-center gap-2 w-full rounded-lg border p-3 bg-muted">
          <Loader2Icon className="animate-spin size-5" />
          <span className="text-sm">
            {t("uploading", {
              processed: uploaderState.processed,
              total: uploaderState.total,
            })}
          </span>
        </div>
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
