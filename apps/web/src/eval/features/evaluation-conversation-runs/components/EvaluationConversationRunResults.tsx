import { Badge } from "@caseai-connect/ui/shad/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@caseai-connect/ui/shad/card"
import { Spinner } from "@caseai-connect/ui/shad/spinner"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type OnChangeFn,
  type PaginationState,
  useReactTable,
} from "@tanstack/react-table"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Loader } from "@/common/components/Loader"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import {
  DEFAULT_PAGE_SIZE,
  PaginationControls,
  TruncatedCell,
} from "@/eval/components/shared/RecordTableParts"
import type {
  EvaluationConversationRun,
  EvaluationConversationRunRecord,
  EvaluationConversationRunRecordStatus,
} from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.models"
import {
  selectCurrentConversationRecordsQuery,
  selectCurrentConversationRunRecords,
} from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.selectors"
import { evaluationConversationRunsActions } from "@/eval/features/evaluation-conversation-runs/evaluation-conversation-runs.slice"
import { TraceUrlOpener } from "@/studio/components/TraceUrlOpener"

function RecordStatusBadge({ status }: { status: EvaluationConversationRunRecordStatus }) {
  const { t } = useTranslation()
  const variant =
    status === "graded"
      ? "success"
      : status === "error"
        ? "destructive"
        : status === "cancelled"
          ? "outline"
          : "secondary"
  return <Badge variant={variant}>{t(`evaluationConversationRun:results.${status}`)}</Badge>
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground">-</span>
  return <Badge variant="secondary">{score}</Badge>
}

export function EvaluationConversationRunRecordsTable({ run }: { run: EvaluationConversationRun }) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const recordsData = useAppSelector(selectCurrentConversationRunRecords)
  const recordsQuery = useAppSelector(selectCurrentConversationRecordsQuery)

  // The initial page is loaded by the run route via mount (ADR 0009); the leaf
  // only refetches when the user changes page. Pagination lives in the slice's
  // records query, so it resets with the run instead of surviving run switches.
  const pagination: PaginationState = { pageIndex: recordsQuery.page, pageSize: recordsQuery.limit }

  const handlePaginationChange: OnChangeFn<PaginationState> = (updater) => {
    const next = typeof updater === "function" ? updater(pagination) : updater
    dispatch(
      evaluationConversationRunsActions.getRecords({
        evaluationConversationRunId: run.id,
        page: next.pageIndex,
        limit: next.pageSize,
      }),
    )
  }

  const records = ADS.isFulfilled(recordsData) ? recordsData.value.records : []
  const total = ADS.isFulfilled(recordsData) ? recordsData.value.total : 0
  const isLoading = ADS.isLoading(recordsData)

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle>{t("evaluationConversationRun:results.records")}</CardTitle>
        <CardDescription>
          {t("evaluationConversationRun:results.recordsDescription", { count: total })}
        </CardDescription>
      </CardHeader>
      {isLoading ? (
        <Loader />
      ) : (
        <RecordsTable
          run={run}
          records={records}
          total={total}
          pagination={pagination}
          onPaginationChange={handlePaginationChange}
        />
      )}
    </Card>
  )
}

type RecordsTableProps = {
  run: EvaluationConversationRun
  records: EvaluationConversationRunRecord[]
  total: number
  pagination: PaginationState
  onPaginationChange: OnChangeFn<PaginationState>
}

function RecordsTable({ run, records, total, pagination, onPaginationChange }: RecordsTableProps) {
  const { t } = useTranslation()
  const isRunning = run.status === "pending" || run.status === "running"
  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE))

  const hasErrors = records.some((record) => record.errorDetails)

  const columns = useMemo<ColumnDef<EvaluationConversationRunRecord>[]>(() => {
    const indexColumn: ColumnDef<EvaluationConversationRunRecord> = {
      id: "__index",
      header: () => "#",
      cell: ({ row, table }) => (
        <span className="font-mono text-xs text-muted-foreground/60">
          {table.getState().pagination.pageIndex * DEFAULT_PAGE_SIZE + row.index + 1}
        </span>
      ),
      size: 48,
    }

    const statusColumn: ColumnDef<EvaluationConversationRunRecord> = {
      id: "status",
      header: () => t("evaluationConversationRun:results.status"),
      cell: ({ row }) => <RecordStatusBadge status={row.original.status} />,
      size: 120,
    }

    const inputColumn: ColumnDef<EvaluationConversationRunRecord> = {
      id: "input",
      header: () => t("evaluationConversationRun:results.input"),
      cell: ({ row }) => <TruncatedCell value={row.original.input} />,
      size: 250,
    }

    const expectedOutputColumn: ColumnDef<EvaluationConversationRunRecord> = {
      id: "expectedOutput",
      header: () => t("evaluationConversationRun:results.expectedOutput"),
      cell: ({ row }) => <TruncatedCell value={row.original.expectedOutput} />,
      size: 250,
    }

    const outputColumn: ColumnDef<EvaluationConversationRunRecord> = {
      id: "output",
      header: () => t("evaluationConversationRun:results.output"),
      cell: ({ row }) => <TruncatedCell value={row.original.output ?? ""} />,
      size: 250,
    }

    const scoreColumn: ColumnDef<EvaluationConversationRunRecord> = {
      id: "score",
      header: () => t("evaluationConversationRun:results.score"),
      cell: ({ row }) => <ScoreBadge score={row.original.score} />,
      size: 80,
    }

    const traceUrlColumn: ColumnDef<EvaluationConversationRunRecord> = {
      id: "traceUrl",
      header: () => <></>,
      cell: ({ row }) => (
        <TraceUrlOpener
          traceUrl={row.original.traceUrl ?? undefined}
          buttonProps={{ size: "sm" }}
        />
      ),
      size: 100,
    }

    const allColumns = [
      indexColumn,
      statusColumn,
      inputColumn,
      expectedOutputColumn,
      outputColumn,
      scoreColumn,
    ]

    if (hasErrors) {
      allColumns.push({
        id: "errorDetails",
        header: () => t("evaluationConversationRun:results.errorDetails"),
        cell: ({ row }) => {
          if (!row.original.errorDetails) return null
          return (
            <span className="text-xs text-destructive truncate block max-w-75">
              {row.original.errorDetails}
            </span>
          )
        },
        size: 300,
      })
    }

    allColumns.push(traceUrlColumn)

    return allColumns
  }, [hasErrors, t])

  const table = useReactTable({
    data: records,
    columns,
    state: {
      pagination,
    },
    onPaginationChange,
    manualPagination: true,
    autoResetAll: false,
    pageCount: totalPages,
    rowCount: total,
    getCoreRowModel: getCoreRowModel(),
  })

  const showPagination = totalPages > 1

  return (
    <CardContent>
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className="bg-muted/50 [&_tr]:border-b">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b transition-colors">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="text-foreground h-auto px-3 py-2 text-left align-bottom font-medium whitespace-nowrap"
                    style={{ width: header.getSize() }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {isRunning ? (
                    <LoadingState run={run} />
                  ) : (
                    t("evaluationConversationRun:results.noRecords")
                  )}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b transition-colors hover:bg-muted/50 ${row.index % 2 !== 0 ? "bg-muted/30" : ""}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="p-3 align-middle"
                      style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showPagination && (
        <PaginationControls
          pageIndex={pagination.pageIndex}
          pageCount={totalPages}
          total={total}
          onPageChange={(newPageIndex) =>
            onPaginationChange((previous) => ({ ...previous, pageIndex: newPageIndex }))
          }
        />
      )}
    </CardContent>
  )
}

function LoadingState({ run }: { run: EvaluationConversationRun }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-2">
      <Spinner className="size-5" />
      <span>
        {t("evaluationConversationRun:results.processingDescription", {
          processed: run.summary ? run.summary.total - run.summary.running : 0,
          total: run.summary?.total ?? 0,
        })}
      </span>
    </div>
  )
}
