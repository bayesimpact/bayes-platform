import type { EvaluationExtractionRunDto } from "@caseai-connect/api-contracts"
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
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader } from "@/common/components/Loader"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import {
  DEFAULT_PAGE_SIZE,
  PaginationControls,
  SortableFilterableHeader,
  TruncatedCell,
} from "@/eval/components/shared/RecordTableParts"
import type {
  EvaluationExtractionDataset,
  EvaluationExtractionDatasetSchemaColumn,
} from "@/eval/features/evaluation-extraction-datasets/evaluation-extraction-datasets.models"
import type {
  EvaluationExtractionRun,
  EvaluationExtractionRunRecord,
  EvaluationExtractionRunRecordFieldStatus,
  EvaluationExtractionRunRecordStatus,
} from "@/eval/features/evaluation-extraction-runs/evaluation-extraction-runs.models"
import { selectCurrentRunRecords } from "@/eval/features/evaluation-extraction-runs/evaluation-extraction-runs.selectors"
import { evaluationExtractionRunsActions } from "@/eval/features/evaluation-extraction-runs/evaluation-extraction-runs.slice"
import { TraceUrlOpener } from "@/studio/components/TraceUrlOpener"

function StatusBadge({ status }: { status: EvaluationExtractionRunRecordStatus }) {
  const { t } = useTranslation()
  const variant =
    status === "match"
      ? "success"
      : status === "mismatch"
        ? "destructive"
        : status === "cancelled"
          ? "outline"
          : "secondary"
  return <Badge variant={variant}>{t(`evaluationExtractionRun:results.${status}`)}</Badge>
}

function FieldStatusBadge({ status }: { status: EvaluationExtractionRunRecordFieldStatus }) {
  const { t } = useTranslation()
  const variant = status === "match" ? "success" : status === "mismatch" ? "destructive" : "outline"
  return (
    <Badge variant={variant} className="text-xs">
      {t(`evaluationExtractionRun:results.${status}`)}
    </Badge>
  )
}

type ResultRow = {
  index: number
  status: EvaluationExtractionRunRecordStatus
  inputs: Record<string, string>
  fields: Record<
    string,
    { agentValue: string; groundTruth: string; status: EvaluationExtractionRunRecordFieldStatus }
  >
  errorDetails: string | null
  traceUrl: string | null
}

function buildResultRows(
  records: EvaluationExtractionRunRecord[],
  inputColumns: EvaluationExtractionDatasetSchemaColumn[],
): ResultRow[] {
  return records.map((record, recordIndex) => {
    const inputs: Record<string, string> = {}
    for (const column of inputColumns) {
      inputs[column.id] = String(record.datasetRecordData?.[column.id] ?? "")
    }

    const fields: ResultRow["fields"] = {}
    if (record.comparison) {
      for (const [key, fieldResult] of Object.entries(record.comparison)) {
        fields[key] = {
          agentValue: String(fieldResult.agentValue ?? ""),
          groundTruth: String(fieldResult.groundTruth ?? ""),
          status: fieldResult.status,
        }
      }
    }

    return {
      index: recordIndex,
      status: record.status,
      inputs,
      fields,
      errorDetails: record.errorDetails,
      traceUrl: record.traceUrl,
    }
  })
}

export function EvaluationExtractionRunRecordsTable({
  run,
  dataset,
}: {
  run: EvaluationExtractionRun
  dataset: EvaluationExtractionDataset
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const recordsData = useAppSelector(selectCurrentRunRecords)

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [debouncedFilters, setDebouncedFilters] = useState<ColumnFiltersState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  })
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchRecords = useCallback(
    (params: { page: number; columnFilters: ColumnFiltersState; sorting: SortingState }) => {
      const activeFilters: Record<string, string> = {}
      for (const filter of params.columnFilters) {
        if (typeof filter.value === "string" && filter.value.length > 0) {
          activeFilters[filter.id] = filter.value
        }
      }

      dispatch(
        evaluationExtractionRunsActions.getRecords({
          evaluationExtractionRunId: run.id,
          page: params.page,
          limit: DEFAULT_PAGE_SIZE,
          columnFilters: Object.keys(activeFilters).length > 0 ? activeFilters : undefined,
          sortBy: params.sorting[0]?.id,
          sortOrder:
            params.sorting[0]?.desc === true
              ? "desc"
              : params.sorting[0]?.desc === false
                ? "asc"
                : undefined,
        }),
      )
    },
    [dispatch, run.id],
  )

  useEffect(() => {
    fetchRecords({ page: pagination.pageIndex, columnFilters: debouncedFilters, sorting })
  }, [fetchRecords, pagination.pageIndex, debouncedFilters, sorting])

  const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> = useCallback(
    (updaterOrValue) => {
      setColumnFilters((prev) => {
        const next = typeof updaterOrValue === "function" ? updaterOrValue(prev) : updaterOrValue
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = setTimeout(() => {
          setDebouncedFilters(next)
          setPagination((prev) => ({ ...prev, pageIndex: 0 }))
        }, 300)
        return next
      })
    },
    [],
  )

  const handleSortingChange: OnChangeFn<SortingState> = useCallback((updaterOrValue) => {
    setSorting((prev) =>
      typeof updaterOrValue === "function" ? updaterOrValue(prev) : updaterOrValue,
    )
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }, [])

  const records = ADS.isFulfilled(recordsData) ? recordsData.value.records : []
  const total = ADS.isFulfilled(recordsData) ? recordsData.value.total : 0
  const isLoading = ADS.isLoading(recordsData)

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle>{t("evaluationExtractionRun:results.records")}</CardTitle>
        <CardDescription>
          {t("evaluation:dataset.records.view.description", { count: total })}
        </CardDescription>
      </CardHeader>
      {isLoading ? (
        <Loader />
      ) : (
        <RecordsTable
          run={run}
          dataset={dataset}
          records={records}
          total={total}
          sorting={sorting}
          columnFilters={columnFilters}
          pagination={pagination}
          onSortingChange={handleSortingChange}
          onColumnFiltersChange={handleColumnFiltersChange}
          onPaginationChange={setPagination}
        />
      )}
    </Card>
  )
}

type RecordsTableProps = {
  run: EvaluationExtractionRun
  dataset: EvaluationExtractionDataset
  records: EvaluationExtractionRunRecord[]
  total: number
  sorting: SortingState
  columnFilters: ColumnFiltersState
  pagination: PaginationState
  onSortingChange: OnChangeFn<SortingState>
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>
  onPaginationChange: OnChangeFn<PaginationState>
}

function RecordsTable({
  run,
  dataset,
  records,
  total,
  sorting,
  columnFilters,
  pagination,
  onSortingChange,
  onColumnFiltersChange,
  onPaginationChange,
}: RecordsTableProps) {
  const { t } = useTranslation()
  const isRunning = run.status === "pending" || run.status === "running"
  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE))

  const inputColumns = useMemo(
    () =>
      Object.values(dataset.schemaMapping)
        .filter((column) => column.role === "input")
        .sort((columnA, columnB) => columnA.index - columnB.index),
    [dataset.schemaMapping],
  )

  const data = useMemo(() => buildResultRows(records, inputColumns), [records, inputColumns])
  const hasErrors = records.some((record) => record.errorDetails)

  const columns = useMemo<ColumnDef<ResultRow>[]>(() => {
    const indexColumn: ColumnDef<ResultRow> = {
      id: "__index",
      header: () => "#",
      cell: ({ row, table }) => (
        <span className="font-mono text-xs text-muted-foreground/60">
          {table.getState().pagination.pageIndex * DEFAULT_PAGE_SIZE + row.original.index + 1}
        </span>
      ),
      size: 48,
      enableSorting: false,
      enableColumnFilter: false,
    }

    const inputColDefs: ColumnDef<ResultRow>[] = inputColumns.map((schemaColumn) => ({
      id: `input_${schemaColumn.id}`,
      accessorFn: (row: ResultRow) => row.inputs[schemaColumn.id] ?? "",
      header: ({ column }) => (
        <SortableFilterableHeader column={column} label={schemaColumn.finalName} badge="input" />
      ),
      cell: ({ row }) => <TruncatedCell value={row.original.inputs[schemaColumn.id] ?? ""} />,
      size: 250,
    }))

    const targetColumns: ColumnDef<ResultRow>[] = run.keyMapping.flatMap((mappingEntry) => {
      const datasetColumn = Object.values(dataset.schemaMapping).find(
        (column) => column.id === mappingEntry.datasetColumnId,
      )
      const targetLabel = datasetColumn?.finalName ?? mappingEntry.datasetColumnId
      const columnDefs: ColumnDef<ResultRow>[] = []

      if (mappingEntry.mode === "scored") {
        columnDefs.push({
          id: `target_${mappingEntry.agentOutputKey}`,
          accessorFn: (row: ResultRow) =>
            row.fields[mappingEntry.agentOutputKey]?.groundTruth ?? "",
          header: ({ column }: { column: Column<ResultRow, unknown> }) => (
            <SortableFilterableHeader column={column} label={targetLabel} badge="target" />
          ),
          cell: ({ row }: { row: { original: ResultRow } }) => {
            const field = row.original.fields[mappingEntry.agentOutputKey]
            if (!field) return <span className="text-muted-foreground">-</span>
            return <TruncatedCell value={String(field.groundTruth)} className="font-mono text-sm" />
          },
          size: 200,
        })
      }

      columnDefs.push({
        id: `agent_${mappingEntry.agentOutputKey}`,
        accessorFn: (row: ResultRow) => row.fields[mappingEntry.agentOutputKey]?.agentValue ?? "",
        header: ({ column }: { column: Column<ResultRow, unknown> }) => (
          <SortableFilterableHeader
            column={column}
            label={mappingEntry.agentOutputKey}
            badge="agent"
          />
        ),
        cell: ({ row }: { row: { original: ResultRow } }) => {
          const field = row.original.fields[mappingEntry.agentOutputKey]
          if (!field) return <span className="text-muted-foreground">-</span>
          return <TruncatedCell value={String(field.agentValue)} className="font-mono text-sm" />
        },
        size: 200,
      })

      return columnDefs
    })

    const statusColumn: ColumnDef<ResultRow> = {
      id: "status",
      accessorFn: (row: ResultRow) => row.status,
      header: ({ column }) => (
        <SortableFilterableHeader
          column={column}
          label={t("evaluationExtractionRun:results.status")}
        />
      ),
      cell: ({ row }) => {
        const scoredEntries = Object.entries(row.original.fields).filter(
          ([, field]) => field.status !== "fyi",
        )
        return (
          <div className="flex items-center gap-1">
            <StatusBadge status={row.original.status} />
            {scoredEntries.length > 1 && (
              <div className="flex gap-0.5">
                {scoredEntries.map(([fieldKey, field]) => (
                  <FieldStatusBadge key={fieldKey} status={field.status} />
                ))}
              </div>
            )}
          </div>
        )
      },
      size: 150,
    }

    const traceUrlColumn: ColumnDef<ResultRow> = {
      id: "traceUrl",
      header: () => <></>,
      cell: ({ row }) => (
        <TraceUrlOpener
          traceUrl={row.original.traceUrl ?? undefined}
          buttonProps={{ size: "sm" }}
        />
      ),
      size: 100,
      enableSorting: false,
      enableColumnFilter: false,
    }

    const allColumns = [indexColumn, ...inputColDefs, ...targetColumns, statusColumn]

    if (hasErrors) {
      allColumns.push({
        id: "errorDetails",
        accessorFn: (row: ResultRow) => row.errorDetails ?? "",
        header: ({ column }) => (
          <SortableFilterableHeader
            column={column}
            label={t("evaluationExtractionRun:results.errorDetails")}
          />
        ),
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
  }, [inputColumns, run.keyMapping, dataset.schemaMapping, hasErrors, t])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      pagination,
    },
    onSortingChange,
    onColumnFiltersChange,
    onPaginationChange,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    autoResetAll: false,
    pageCount: totalPages,
    rowCount: total,
    getCoreRowModel: getCoreRowModel(),
  })

  const hasFilters = columnFilters.some(
    (filter) => typeof filter.value === "string" && filter.value.length > 0,
  )
  const showPagination = totalPages > 1 || hasFilters

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
                    t("evaluationExtractionRun:results.noRecords")
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
            onPaginationChange((prev) => ({ ...prev, pageIndex: newPageIndex }))
          }
        />
      )}
    </CardContent>
  )
}

function LoadingState({ run }: { run: EvaluationExtractionRunDto }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-2">
      <Spinner className="size-5" />
      <span>
        {t("evaluationExtractionRun:results.processingDescription", {
          processed: run.summary ? run.summary.total - run.summary.running : 0,
          total: run.summary?.total ?? 0,
        })}
      </span>
    </div>
  )
}
