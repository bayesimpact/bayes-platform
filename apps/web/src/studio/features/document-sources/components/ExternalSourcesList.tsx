import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@caseai-connect/ui/shad/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@caseai-connect/ui/shad/table"
import { EllipsisVerticalIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { GridHeader } from "@/common/components/grid/Grid"
import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { useValue } from "@/common/hooks/use-value"
import { buildSince } from "@/common/utils/build-date"
import type { DocumentSource } from "../document-sources.models"
import { selectDocumentSourcesData } from "../document-sources.selectors"

export function ExternalSourcesList() {
  const documentSources = useValue(selectDocumentSourcesData)
  const { t } = useTranslation("documentSource")
  const navigate = useNavigate()
  const projectRoute = useGetProjectRoute()

  const indexed = documentSources.reduce(
    (total, documentSource) => total + documentSource.indexedDocumentCount,
    0,
  )
  const active = documentSources.filter(
    (documentSource) => documentSource.status === "ready",
  ).length
  const errors = documentSources.filter(
    (documentSource) => documentSource.status === "error",
  ).length

  return (
    <>
      <GridHeader
        onBack={() => navigate(projectRoute)}
        title={t("title")}
        description={t("description")}
      />
      <div className="p-6 flex flex-col gap-3 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-medium rounded-tl-lg bg-muted">
                {t("columns.source")}
              </TableHead>
              <TableHead className="font-medium bg-muted">{t("columns.app")}</TableHead>
              <TableHead className="font-medium bg-muted">{t("columns.docs")}</TableHead>
              <TableHead className="font-medium bg-muted">{t("columns.lastSync")}</TableHead>
              <TableHead className="font-medium bg-muted">{t("columns.status")}</TableHead>
              <TableHead className="w-10 rounded-tr-lg bg-muted" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {documentSources.map((documentSource) => (
              <DocumentSourceRow key={documentSource.id} documentSource={documentSource} />
            ))}
          </TableBody>
        </Table>
        <p className="text-sm text-muted-foreground">
          {t("summary", {
            indexed: t("indexed", { count: indexed }),
            active: t("active", { count: active }),
            errors: t("errors", { count: errors }),
          })}
        </p>
      </div>
    </>
  )
}

function DocumentSourceRow({ documentSource }: { documentSource: DocumentSource }) {
  const { t } = useTranslation()
  const detail = documentSource.baseUrl ?? documentSource.externalId

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span>{documentSource.name}</span>
          {detail && <span className="text-sm text-muted-foreground">{detail}</span>}
        </div>
      </TableCell>
      <TableCell>{documentSource.type ?? "—"}</TableCell>
      <TableCell>{documentSource.documentCount}</TableCell>
      <TableCell className="text-muted-foreground">
        {documentSource.lastSyncedAt ? buildSince(documentSource.lastSyncedAt) : "—"}
      </TableCell>
      <TableCell>
        <DocumentSourceStatusBadge status={documentSource.status} />
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label={t("actions:more")}>
              <EllipsisVerticalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" />
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

function DocumentSourceStatusBadge({ status }: { status: DocumentSource["status"] }) {
  const { t } = useTranslation("status")
  if (status === "error") {
    return <Badge variant="destructive">{t("error")}</Badge>
  }
  return <Badge variant="success">{t("ready")}</Badge>
}
