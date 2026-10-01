import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@caseai-connect/ui/shad/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@caseai-connect/ui/shad/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@caseai-connect/ui/shad/table"
import { EllipsisVerticalIcon, Trash2Icon } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { GridHeader } from "@/common/components/grid/Grid"
import { useGetProjectRoute } from "@/common/hooks/use-get-path"
import { useValue } from "@/common/hooks/use-value"
import { useAppDispatch } from "@/common/store/hooks"
import { buildSince } from "@/common/utils/build-date"
import type { DocumentSource } from "../document-sources.models"
import { selectDocumentSourcesData } from "../document-sources.selectors"
import { deleteDocumentSource } from "../document-sources.thunks"

const LINK_HEAD = 28
const LINK_TAIL = 18

export function ExternalSourcesList() {
  const documentSources = useValue(selectDocumentSourcesData)
  const { t } = useTranslation("documentSource")
  const navigate = useNavigate()
  const projectRoute = useGetProjectRoute()

  return (
    <>
      <GridHeader
        onBack={() => navigate(projectRoute)}
        title={t("title")}
        description={t("description")}
      />
      <div className="bg-white p-6">
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
      </div>
    </>
  )
}

function DocumentSourceRow({ documentSource }: { documentSource: DocumentSource }) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const detail = documentSource.baseUrl ?? documentSource.externalId

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span>{documentSource.name}</span>
          {detail && <SourceLink value={detail} />}
        </div>
      </TableCell>
      <TableCell>
        <DocumentSourceAppCell app={documentSource.app} />
      </TableCell>
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
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
              <Trash2Icon className="size-4" />
              {t("actions:delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ConfirmDialog
          open={confirmOpen}
          title={t("documentSource:delete.title", { name: documentSource.name })}
          description={t("documentSource:delete.description")}
          onConfirm={() => {
            setConfirmOpen(false)
            void dispatch(deleteDocumentSource({ documentSourceId: documentSource.id }))
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      </TableCell>
    </TableRow>
  )
}

function DocumentSourceAppCell({ app }: { app: DocumentSource["app"] }) {
  if (!app) return null
  return (
    <div className="flex items-center gap-2">
      {app.logoUrl && <img src={app.logoUrl} alt="" className="size-6 rounded object-contain" />}
      <span className="text-sm text-muted-foreground">{app.name}</span>
    </div>
  )
}

function SourceLink({ value }: { value: string }) {
  const truncated = truncateMiddle(value)
  if (!truncated) return <span className="text-sm text-muted-foreground">{value}</span>

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="max-w-full text-left text-sm text-muted-foreground">
          {truncated}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 break-all text-sm">{value}</PopoverContent>
    </Popover>
  )
}

function truncateMiddle(value: string): string | null {
  if (value.length <= LINK_HEAD + LINK_TAIL + 3) return null
  return `${value.slice(0, LINK_HEAD)}...${value.slice(-LINK_TAIL)}`
}

function DocumentSourceStatusBadge({ status }: { status: DocumentSource["status"] }) {
  const { t } = useTranslation("status")
  if (status === "error") {
    return <Badge variant="destructive">{t("error")}</Badge>
  }
  return <Badge variant="success">{t("ready")}</Badge>
}
