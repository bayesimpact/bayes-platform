import { LEGACY_WEB_CRAWL_DOCUMENT_SOURCE_TYPE } from "@caseai-connect/api-contracts"
import { Alert, AlertDescription, AlertTitle } from "@caseai-connect/ui/shad/alert"
import { Badge } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@caseai-connect/ui/shad/dropdown-menu"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@caseai-connect/ui/shad/empty"
import { Popover, PopoverContent, PopoverTrigger } from "@caseai-connect/ui/shad/popover"
import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { EllipsisVerticalIcon, InfoIcon, Trash2Icon } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { DataTable, type DataTableColumnMeta } from "@/common/components/data-table/DataTable"
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
  // TanStack Table keeps one table instance across renders, so the React Compiler would
  // memoize its row model and show stale rows after a deletion.
  "use no memo"
  const documentSources = useValue(selectDocumentSourcesData)
  const { t } = useTranslation("documentSource")
  const navigate = useNavigate()
  const projectRoute = useGetProjectRoute()

  const columns = useMemo<ColumnDef<DocumentSource>[]>(
    () => [
      {
        id: "source",
        header: () => t("columns.source"),
        cell: ({ row }) => <DocumentSourceNameCell documentSource={row.original} />,
      },
      {
        id: "app",
        header: () => t("columns.app"),
        cell: ({ row }) => <DocumentSourceAppCell documentSource={row.original} />,
      },
      {
        id: "docs",
        header: () => t("columns.docs"),
        cell: ({ row }) => row.original.documentCount,
      },
      {
        id: "lastSync",
        header: () => t("columns.lastSync"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.lastSyncedAt ? buildSince(row.original.lastSyncedAt) : "—"}
          </span>
        ),
      },
      {
        id: "status",
        header: () => t("columns.status"),
        cell: ({ row }) => <DocumentSourceStatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        meta: { className: "w-10" } satisfies DataTableColumnMeta,
        header: () => null,
        cell: ({ row }) => <DocumentSourceActions documentSource={row.original} />,
      },
    ],
    [t],
  )

  const table = useReactTable({
    data: documentSources,
    columns,
    getRowId: (documentSource) => documentSource.id,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <>
      <GridHeader
        onBack={() => navigate(projectRoute)}
        title={t("title")}
        description={t("description")}
      />
      <div className="flex flex-col gap-4 bg-white p-6">
        {documentSources.some(isLegacyWebCrawlSource) && (
          <Alert>
            <InfoIcon />
            <AlertTitle>{t("legacyWebCrawl.title")}</AlertTitle>
            <AlertDescription>{t("legacyWebCrawl.description")}</AlertDescription>
          </Alert>
        )}
        <DataTable
          table={table}
          empty={
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{t("empty.title")}</EmptyTitle>
                <EmptyDescription>{t("empty.description")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          }
        />
      </div>
    </>
  )
}

function DocumentSourceNameCell({ documentSource }: { documentSource: DocumentSource }) {
  const detail = documentSource.baseUrl ?? documentSource.externalId
  return (
    <div className="flex flex-col">
      <span>{documentSource.name}</span>
      {detail && <SourceLink value={detail} />}
    </div>
  )
}

function DocumentSourceActions({ documentSource }: { documentSource: DocumentSource }) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <>
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
    </>
  )
}

function isLegacyWebCrawlSource(documentSource: DocumentSource): boolean {
  return documentSource.type === LEGACY_WEB_CRAWL_DOCUMENT_SOURCE_TYPE
}

function DocumentSourceAppCell({ documentSource }: { documentSource: DocumentSource }) {
  const { t } = useTranslation("documentSource")
  const { app } = documentSource
  if (!app) {
    return isLegacyWebCrawlSource(documentSource) ? (
      <Badge variant="outline">{t("legacyWebCrawl.badge")}</Badge>
    ) : null
  }
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
