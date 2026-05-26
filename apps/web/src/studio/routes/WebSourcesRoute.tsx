import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { Collapsible, CollapsibleTrigger } from "@caseai-connect/ui/shad/collapsible"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@caseai-connect/ui/shad/table"
import { ChevronDownIcon, ChevronRightIcon, ExternalLinkIcon, GlobeIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { buildSince } from "@/common/utils/build-date"
import type { DocumentTag } from "@/studio/features/document-tags/document-tags.models"
import { selectDocumentTagsData } from "@/studio/features/document-tags/document-tags.selectors"
import { CrawlUrlButton } from "@/studio/features/documents/components/CrawlUrlButton"
import { WebSourceDocumentActions } from "@/studio/features/documents/components/DocumentActions"
import { EmbeddingStatusBadge } from "@/studio/features/documents/components/EmbeddingStatusBadge"
import { EmptyWebSources } from "@/studio/features/documents/components/EmptyWebSources"
import type { Document } from "@/studio/features/documents/documents.models"
import {
  selectCrawlProgressByDocumentId,
  selectDocumentsData,
} from "@/studio/features/documents/documents.selectors"
import { documentsActions } from "@/studio/features/documents/documents.slice"
import { AsyncRoute } from "../../common/routes/AsyncRoute"
import { DocumentTagsSheet } from "../features/document-tags/components/DocumentTagsSheet"
import { getTagFullPath } from "./DocumentsRoute"

export function WebSourcesRoute() {
  useWebSourceStreams()
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

  const visibleDocuments = documents.filter((document) => document.sourceType === "webCrawl")

  return (
    <div className="w-full">
      <GridHeader
        onBack={handleBack}
        title={t("document:webSources.title")}
        description={t("document:webSources.description")}
        action={
          <div className="flex items-center gap-2">
            <CrawlUrlButton />
            <DocumentTagsSheet documentTags={documentTags} />
          </div>
        }
      />

      <div className="p-6 flex flex-col gap-6 bg-white">
        {visibleDocuments.length === 0 ? (
          <EmptyWebSources />
        ) : (
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
                <WebSourceRow key={document.id} document={document} documentTags={documentTags} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

function WebSourceRow({
  document,
  documentTags,
}: {
  document: Document
  documentTags: DocumentTag[]
}) {
  const date = buildSince(document.updatedAt)
  const hasPages = document.pages && document.pages.length > 0
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
              <GlobeIcon className="size-4 text-muted-foreground shrink-0" />
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
          <EmbeddingStatusBadge
            status={document.embeddingStatus}
            sourceType={document.sourceType}
            pagesCrawled={pagesCrawled}
          />
        </TableCell>
        <TableCell className="text-muted-foreground">{date}</TableCell>
        <TableCell>
          <WebSourceDocumentActions document={document} documentTags={documentTags} />
        </TableCell>
      </TableRow>
      {document.pages && isOpen
        ? document.pages.map((page) => (
            <TableRow key={page.url} className="bg-muted/30">
              <TableCell colSpan={6} className="pl-16 max-w-0">
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

function useWebSourceStreams() {
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(documentsActions.setCurrentSourceType({ sourceType: "webCrawl" }))
    dispatch(documentsActions.startEmbeddingStatusStream())
    dispatch(documentsActions.startCrawlProgressStream())
    return () => {
      dispatch(documentsActions.setCurrentSourceType({ sourceType: null }))
      dispatch(documentsActions.stopEmbeddingStatusStream())
      dispatch(documentsActions.stopCrawlProgressStream())
    }
  }, [dispatch])
}
