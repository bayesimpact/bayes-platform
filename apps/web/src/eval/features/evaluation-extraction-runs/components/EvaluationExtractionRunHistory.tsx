import { Button } from "@caseai-connect/ui/shad/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@caseai-connect/ui/shad/card"
import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { ArrowRightIcon, GitCompareIcon } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { DataTable } from "@/common/components/data-table/DataTable"
import { buildSelectionColumn } from "@/common/components/data-table/selection-column"
import { selectAgentsData } from "@/common/features/agents/agents.selectors"
import { useValue } from "@/common/hooks/use-value"
import { buildSince } from "@/common/utils/build-date"
import { shortRunId } from "@/eval/features/evaluation-extraction-runs/evaluation-extraction-runs.helpers"
import type { EvaluationExtractionRun } from "@/eval/features/evaluation-extraction-runs/evaluation-extraction-runs.models"
import { useEvaluationExtractionRunPath } from "@/eval/hooks/use-evaluation-extraction-run-path"
import { DocumentOpener } from "@/studio/features/documents/components/DocumentOpener"
import { AgentMetadataDialog } from "./AgentMetadataDialog"
import { DeleteEvaluationExtractionRunButton } from "./DeleteEvaluationExtractionRunButton"
import { RunStatusBadge } from "./RunStatusBadge"

function buildMatchRate(run: EvaluationExtractionRun): number | null {
  if (!run.summary || run.summary.total === 0) return null
  return Math.round((run.summary.perfectMatches / run.summary.total) * 100)
}

export function EvaluationExtractionRunHistory({ runs }: { runs: EvaluationExtractionRun[] }) {
  // TanStack Table keeps one table instance across renders, so the React Compiler would
  // memoize its row model and miss selection changes, which the compare button reads.
  "use no memo"
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { buildRunPath, buildComparePath } = useEvaluationExtractionRunPath()
  const agents = useValue(selectAgentsData)

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})

  const agentNameById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent.name])),
    [agents],
  )

  const handleOpen = useCallback(
    (runId: string) => {
      navigate(buildRunPath({ runId }))
    },
    [navigate, buildRunPath],
  )

  const columns = useMemo<ColumnDef<EvaluationExtractionRun>[]>(
    () => [
      buildSelectionColumn<EvaluationExtractionRun>({ rowLabel: () => t("actions:select") }),
      {
        id: "id",
        header: () => t("evaluationExtractionRun:history.columns.id"),
        cell: ({ row }) => (
          <span className="text-sm font-mono text-muted-foreground whitespace-nowrap">
            {shortRunId(row.original.id)}
          </span>
        ),
      },
      {
        id: "status",
        header: () => t("evaluationExtractionRun:history.columns.status"),
        cell: ({ row }) => <RunStatusBadge status={row.original.status} />,
      },
      {
        id: "date",
        header: () => t("evaluationExtractionRun:history.columns.date"),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {buildSince(row.original.updatedAt)}
          </span>
        ),
      },
      {
        id: "agent",
        header: () => t("evaluationExtractionRun:history.columns.agent"),
        cell: ({ row }) => {
          const agentName = agentNameById.get(row.original.agentId)
          if (!agentName) return <span className="text-muted-foreground">-</span>
          return <span className="text-sm">{agentName}</span>
        },
      },
      {
        id: "version",
        header: () => t("evaluationExtractionRun:history.columns.version"),
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">
            {t("evaluationExtractionRun:version.revision", {
              revision: row.original.agentRevision,
            })}
          </span>
        ),
      },
      {
        id: "matchRate",
        header: () => t("evaluationExtractionRun:history.columns.matchRate"),
        cell: ({ row }) => {
          const matchRate = buildMatchRate(row.original)
          if (matchRate === null) return <span className="text-muted-foreground">-</span>
          return (
            <span className="text-sm font-medium whitespace-nowrap">
              {t("evaluationExtractionRun:history.matchRate", { matchRate })}
            </span>
          )
        },
      },
      {
        id: "records",
        header: () => t("evaluationExtractionRun:history.columns.records"),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {row.original.summary?.total ?? 0}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            {row.original.csvExportDocumentId && (
              <DocumentOpener
                buttonProps={{ size: "sm" }}
                documentId={row.original.csvExportDocumentId}
              />
            )}
            <AgentMetadataDialog
              buttonProps={{ variant: "secondary", size: "sm" }}
              agentId={row.original.agentId}
              revision={row.original.agentRevision}
            />
            <DeleteEvaluationExtractionRunButton
              buttonProps={{ variant: "secondary", size: "icon-sm" }}
              runId={row.original.id}
            />
            <Button onClick={() => handleOpen(row.original.id)} size="icon-sm">
              <ArrowRightIcon className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [t, agentNameById, handleOpen],
  )

  const table = useReactTable({
    data: runs,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getRowId: (run) => run.id,
    getCoreRowModel: getCoreRowModel(),
  })

  const selectedRunIds = table.getSelectedRowModel().rows.map((row) => row.original.id)
  const canCompare = selectedRunIds.length >= 2

  const handleCompare = () => {
    navigate(buildComparePath({ runIds: selectedRunIds }))
  }

  if (runs.length === 0) return null

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle>{t("evaluationExtractionRun:history.title")}</CardTitle>
        <CardDescription>
          {t("evaluationExtractionRun:history.description", { count: runs.length })}
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={handleCompare} disabled={!canCompare}>
            <GitCompareIcon className="size-4" />
            {selectedRunIds.length > 0
              ? t("evaluationExtractionRun:history.compareSelected", {
                  count: selectedRunIds.length,
                })
              : t("evaluationExtractionRun:history.compare")}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {/* The history is hidden while there is no run, so the table never shows empty. */}
        <DataTable table={table} empty={null} />
      </CardContent>
    </Card>
  )
}
