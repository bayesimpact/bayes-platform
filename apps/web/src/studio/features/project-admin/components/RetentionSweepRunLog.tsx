import { Badge } from "@caseai-connect/ui/shad/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@caseai-connect/ui/shad/tooltip"
import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { format } from "date-fns"
import { InfoIcon } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { DataTable } from "@/common/components/data-table/DataTable"
import { MarkdownWrapper } from "@/common/features/agents/agent-sessions/shared/agent-session-messages/components/MarkdownWrapper"
import type {
  RetentionSweepRun,
  RetentionSweepRunStatus,
  RetentionSweepRuns,
} from "@/common/features/projects/projects.models"
import { getLocale } from "@/common/utils/get-locale"

const STATUS_VARIANTS: Record<RetentionSweepRunStatus, "success" | "warning" | "destructive"> = {
  OK: "success",
  PARTIAL: "warning",
  ERROR: "destructive",
}

export function RetentionSweepRunLog({ log }: { log: RetentionSweepRuns }) {
  const { t } = useTranslation()
  const locale = getLocale()

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium">{t("projectAdmin:retention.logTitle")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("projectAdmin:retention.nextRun", {
            date: format(log.nextRunAt, "PPp", { locale }),
          })}
        </p>
      </div>
      {log.runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("projectAdmin:retention.logEmpty")}</p>
      ) : (
        <RetentionSweepRunTable runs={log.runs} />
      )}
    </div>
  )
}

function RetentionSweepRunTable({ runs }: { runs: RetentionSweepRun[] }) {
  // TanStack Table keeps one table instance across renders, so the React Compiler would
  // memoize its row model and show stale rows.
  "use no memo"
  const { t } = useTranslation()
  const locale = getLocale()

  const columns = useMemo<ColumnDef<RetentionSweepRun>[]>(
    () => [
      {
        id: "date",
        header: () => t("projectAdmin:retention.columnDate"),
        cell: ({ row }) => format(row.original.ranAt, "PPp", { locale }),
      },
      {
        id: "purged",
        header: () => t("projectAdmin:retention.columnPurged"),
        cell: ({ row }) => row.original.purgedCount,
      },
      {
        id: "status",
        header: () => t("projectAdmin:retention.columnStatus"),
        cell: ({ row }) => <RetentionSweepRunStatusCell run={row.original} />,
      },
    ],
    [t, locale],
  )

  const table = useReactTable({
    data: runs,
    columns,
    getRowId: (run) => run.id,
    getCoreRowModel: getCoreRowModel(),
  })

  return <DataTable table={table} empty={t("projectAdmin:retention.logEmpty")} />
}

function RetentionSweepRunStatusCell({ run }: { run: RetentionSweepRun }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant={STATUS_VARIANTS[run.status]}>{run.status}</Badge>
      {/* The run report shows on hover of the info icon. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <InfoIcon className="size-3.5 cursor-help text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-sm">
          <MarkdownWrapper content={run.report} />
        </TooltipContent>
      </Tooltip>
    </span>
  )
}
