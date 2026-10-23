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
import { shortRunId } from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.helpers"
import type { EvaluationConversationRun } from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.models"
import { useEvaluationConversationRunPath } from "@/eval/hooks/use-evaluation-conversation-run-path"
import { AgentMetadataDialog } from "./AgentMetadataDialog"
import { DeleteEvaluationConversationRunButton } from "./DeleteEvaluationConversationRunButton"
import { RunStatusBadge } from "./RunStatusBadge"

export function EvaluationConversationRunHistory({ runs }: { runs: EvaluationConversationRun[] }) {
  // TanStack Table keeps one table instance across renders, so the React Compiler would
  // memoize its row model and miss selection changes, which the compare button reads.
  "use no memo"
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { buildConversationRunPath, buildConversationComparePath } =
    useEvaluationConversationRunPath()
  const agents = useValue(selectAgentsData)

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({})

  const agentNameById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent.name])),
    [agents],
  )

  const handleOpen = useCallback(
    (runId: string) => {
      navigate(buildConversationRunPath({ runId }))
    },
    [navigate, buildConversationRunPath],
  )

  const columns = useMemo<ColumnDef<EvaluationConversationRun>[]>(
    () => [
      buildSelectionColumn<EvaluationConversationRun>({ rowLabel: () => t("actions:select") }),
      {
        id: "id",
        header: () => t("evaluationConversationRun:history.columns.id"),
        cell: ({ row }) => (
          <span className="text-sm font-mono text-muted-foreground whitespace-nowrap">
            {shortRunId(row.original.id)}
          </span>
        ),
      },
      {
        id: "status",
        header: () => t("evaluationConversationRun:history.columns.status"),
        cell: ({ row }) => <RunStatusBadge status={row.original.status} />,
      },
      {
        id: "date",
        header: () => t("evaluationConversationRun:history.columns.date"),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {buildSince(row.original.updatedAt)}
          </span>
        ),
      },
      {
        id: "agent",
        header: () => t("evaluationConversationRun:history.columns.agent"),
        cell: ({ row }) => {
          const agentName = agentNameById.get(row.original.agentId)
          if (!agentName) return <span className="text-muted-foreground">-</span>
          return <span className="text-sm">{agentName}</span>
        },
      },
      {
        id: "version",
        header: () => t("evaluationConversationRun:history.columns.version"),
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">
            {t("evaluationConversationRun:version.revision", {
              revision: row.original.agentSettings.revision,
            })}
          </span>
        ),
      },
      {
        id: "model",
        header: () => t("evaluationConversationRun:history.columns.model"),
        cell: ({ row }) => (
          <span className="text-sm font-mono whitespace-nowrap">
            {row.original.agentSettings.model}
          </span>
        ),
      },
      {
        id: "judgeModel",
        header: () => t("evaluationConversationRun:history.columns.judgeModel"),
        cell: ({ row }) => (
          <span className="text-sm font-mono whitespace-nowrap">{row.original.judgeModel}</span>
        ),
      },
      {
        id: "averageScore",
        header: () => t("evaluationConversationRun:history.columns.averageScore"),
        cell: ({ row }) => {
          const summary = row.original.summary
          if (!summary || summary.averageScore === null) {
            return <span className="text-muted-foreground">-</span>
          }
          return (
            <span className="text-sm font-medium whitespace-nowrap">
              {t("evaluationConversationRun:history.averageScoreValue", {
                averageScore: Math.round(summary.averageScore * 10) / 10,
              })}
            </span>
          )
        },
      },
      {
        id: "records",
        header: () => t("evaluationConversationRun:history.columns.records"),
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
            <AgentMetadataDialog
              buttonProps={{ variant: "secondary", size: "sm" }}
              agentId={row.original.agentId}
              agentSettings={row.original.agentSettings}
            />
            <DeleteEvaluationConversationRunButton
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
    navigate(buildConversationComparePath({ runIds: selectedRunIds }))
  }

  if (runs.length === 0) return null

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle>{t("evaluationConversationRun:history.title")}</CardTitle>
        <CardDescription>
          {t("evaluationConversationRun:history.description", { count: runs.length })}
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={handleCompare} disabled={!canCompare}>
            <GitCompareIcon className="size-4" />
            {selectedRunIds.length > 0
              ? t("evaluationConversationRun:history.compareSelected", {
                  count: selectedRunIds.length,
                })
              : t("evaluationConversationRun:history.compare")}
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
