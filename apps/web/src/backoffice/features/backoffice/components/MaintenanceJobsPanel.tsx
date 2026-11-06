import { Badge, type BadgeVariant } from "@caseai-connect/ui/shad/badge"
import { Button } from "@caseai-connect/ui/shad/button"
import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { Loader2Icon, PlayIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { ConfirmDialog } from "@/common/components/ConfirmDialog"
import { DataTable, type DataTableColumnMeta } from "@/common/components/data-table/DataTable"
import { useMount } from "@/common/hooks/use-mount"
import { useValue } from "@/common/hooks/use-value"
import { AsyncRoute } from "@/common/routes/AsyncRoute"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import type {
  MaintenanceJob,
  MaintenanceJobRun,
  MaintenanceJobRunState,
} from "../backoffice.models"
import { selectMaintenanceJobs } from "../backoffice.selectors"
import { backofficeActions } from "../backoffice.slice"

const RUN_STATE_LABEL: Record<MaintenanceJobRunState, string> = {
  waiting: "Waiting",
  active: "Running",
  completed: "Done",
  failed: "Failed",
}

const RUN_STATE_VARIANT: Record<MaintenanceJobRunState, BadgeVariant> = {
  waiting: "secondary",
  active: "warning",
  completed: "success",
  failed: "destructive",
}

export function MaintenanceJobsPanel() {
  const maintenanceJobs = useAppSelector(selectMaintenanceJobs)

  useMount({
    actions: {
      mount: backofficeActions.maintenanceJobsPanelMount,
      unmount: backofficeActions.maintenanceJobsPanelUnmount,
    },
  })

  return (
    <AsyncRoute data={[maintenanceJobs]}>
      <WithData />
    </AsyncRoute>
  )
}

function WithData() {
  // TanStack Table keeps one table instance across renders, so the React Compiler would
  // memoize its row model and show stale rows after a reload.
  "use no memo"
  const maintenanceJobs = useValue(selectMaintenanceJobs)
  const dispatch = useAppDispatch()
  const [jobToRun, setJobToRun] = useState<MaintenanceJob | null>(null)

  const columns = useMemo<ColumnDef<MaintenanceJob>[]>(
    () => [
      {
        accessorKey: "title",
        header: () => "Job",
        meta: { className: "w-full", cellClassName: "align-top" } satisfies DataTableColumnMeta,
        cell: ({ row }) => (
          <div className="flex flex-col gap-1 whitespace-normal">
            <span className="font-medium">{row.original.title}</span>
            <span className="text-sm text-muted-foreground">{row.original.description}</span>
          </div>
        ),
      },
      {
        accessorKey: "remainingSummary",
        header: () => "Left to do",
        meta: { cellClassName: "align-top" } satisfies DataTableColumnMeta,
        cell: ({ row }) =>
          row.original.remainingCount === 0 ? (
            <span className="text-sm text-muted-foreground">Nothing left</span>
          ) : (
            <span className="text-sm">{row.original.remainingSummary}</span>
          ),
      },
      {
        id: "lastRun",
        header: () => "Last run",
        meta: { cellClassName: "align-top" } satisfies DataTableColumnMeta,
        cell: ({ row }) => <LastRun run={row.original.lastRun} />,
      },
      {
        id: "actions",
        header: () => null,
        meta: { cellClassName: "align-top" } satisfies DataTableColumnMeta,
        cell: ({ row }) => {
          const isRunning =
            row.original.lastRun?.state === "waiting" || row.original.lastRun?.state === "active"
          return (
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isRunning}
                onClick={() => setJobToRun(row.original)}
              >
                {isRunning ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <PlayIcon className="size-4" />
                )}
                Run
              </Button>
            </div>
          )
        },
      },
    ],
    [],
  )

  const table = useReactTable({
    data: maintenanceJobs,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <>
      <div className="p-4 border-b">
        <p className="text-sm text-muted-foreground">
          One-off data migrations, run by the workers across every organization. Running a job again
          only handles what is left.
        </p>
      </div>
      <div className="p-4">
        <DataTable
          table={table}
          empty={<p className="text-center text-muted-foreground">No maintenance job</p>}
        />
      </div>
      <ConfirmDialog
        open={jobToRun !== null}
        title={`Run "${jobToRun?.title ?? ""}"?`}
        description={`It changes data in every organization of this platform: ${jobToRun?.remainingSummary ?? ""}.`}
        confirmLabel="Run"
        confirmVariant="default"
        onConfirm={() => {
          if (jobToRun) void dispatch(backofficeActions.runMaintenanceJob(jobToRun.key))
          setJobToRun(null)
        }}
        onCancel={() => setJobToRun(null)}
      />
    </>
  )
}

function LastRun({ run }: { run: MaintenanceJobRun | null }) {
  if (!run) {
    return <span className="text-sm text-muted-foreground">Never run</span>
  }
  const date = new Date(run.finishedAt ?? run.requestedAt).toLocaleString()
  return (
    <div className="flex min-w-56 flex-col items-start gap-1 whitespace-normal">
      <div className="flex items-center gap-2">
        <Badge variant={RUN_STATE_VARIANT[run.state]}>{RUN_STATE_LABEL[run.state]}</Badge>
        {run.progress && (
          <span className="text-xs text-muted-foreground">
            {run.progress.done} / {run.progress.total}
          </span>
        )}
      </div>
      <span className="text-xs text-muted-foreground">{date}</span>
      {run.summary && <span className="text-sm">{run.summary}</span>}
      {run.error && <span className="text-sm text-destructive">{run.error}</span>}
    </div>
  )
}
