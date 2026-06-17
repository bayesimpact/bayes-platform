import { Card, CardContent, CardHeader, CardTitle } from "@caseai-connect/ui/shad/card"
import { Spinner } from "@caseai-connect/ui/shad/spinner"
import {
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
import {
  DEFAULT_PAGE_SIZE,
  PaginationControls,
  SortableFilterableHeader,
  TruncatedCell,
} from "@/common/components/shared/RecordTableParts"
import { ADS } from "@/common/store/async-data-status"
import { useAppDispatch, useAppSelector } from "@/common/store/hooks"
import { TraceUrlOpener } from "@/studio/components/TraceUrlOpener"
import type {
  AgentCsvExtractionRun,
  AgentCsvExtractionRunRecord,
  AgentCsvExtractionRunRecordStatus,
} from "../agent-csv-extraction-runs.models"
import { selectCurrentRunRecords } from "../agent-csv-extraction-runs.selectors"
import { agentCsvExtractionRunsActions } from "../agent-csv-extraction-runs.slice"
import { RecordStatusBadge } from "./AgentCsvExtractionRunStatusBadge"

type ResultRow = {
  index: number
  rowIndex: number
  status: AgentCsvExtractionRunRecordStatus
  inputData: Record<string, unknown>
  agentRawOutput: Record<string, unknown>
  errorDetails: string | null
  traceUrl: string | null
}

function buildResultRows(records: AgentCsvExtractionRunRecord[]): ResultRow[] {
  return records.map((record, recordIndex) => ({
    index: recordIndex,
    rowIndex: record.rowIndex,
    status: record.status,
    inputData: record.inputData ?? {},
    agentRawOutput: record.agentRawOutput ?? {},
    errorDetails: record.errorDetails,
    traceUrl: record.traceUrl,
  }))
}

export function AgentCsvExtractionRunRecordsTable({ run }: { run: AgentCsvExtractionRun }) {
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
        agentCsvExtractionRunsActions.getRecords({
          agentId: run.agentId,
          agentCsvExtractionRunId: run.id,
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
    [dispatch, run.id, run.agentId],
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
  const isRunning = run.status === "pending" || run.status === "running"

  const inputColumns = useMemo(
    () =>
      Object.values(run.columnSchema)
        .filter((column) => column.role === "input")
        .sort((columnA, columnB) => columnA.index - columnB.index),
    [run.columnSchema],
  )

  const outputKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const record of records) {
      if (record.agentRawOutput) {
        for (const key of Object.keys(record.agentRawOutput)) {
          keys.add(key)
        }
      }
    }
    return Array.from(keys)
  }, [records])

  const data = useMemo(() => buildResultRows(records), [records])
  const hasErrors = records.some((record) => record.errorDetails)
  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE))

  const columns = useMemo<ColumnDef<ResultRow>[]>(() => {
    const indexColumn: ColumnDef<ResultRow> = {
      id: "__index",
      header: () => t("agentCsvExtractionRun:results.index"),
      cell: ({ row, table }) => (
        <span className="font-mono text-xs text-muted-foreground/60">
          {table.getState().pagination.pageIndex * DEFAULT_PAGE_SIZE + row.original.index + 1}
        </span>
      ),
      size: 48,
      enableSorting: false,
      enableColumnFilter: false,
    }

    const statusColumn: ColumnDef<ResultRow> = {
      id: "status",
      accessorFn: (row: ResultRow) => row.status,
      header: ({ column }) => (
        <SortableFilterableHeader
          column={column}
          label={t("agentCsvExtractionRun:results.status")}
          className="text-semibold text-inherit"
        />
      ),
      cell: ({ row }) => <RecordStatusBadge status={row.original.status} />,
      size: 120,
    }

    const inputColDefs: ColumnDef<ResultRow>[] = inputColumns.map((schemaColumn) => ({
      id: `input_${schemaColumn.id}`,
      accessorFn: (row: ResultRow) => String(row.inputData[schemaColumn.id] ?? ""),
      header: ({ column }) => (
        <SortableFilterableHeader column={column} label={schemaColumn.finalName} badge="input" />
      ),
      cell: ({ row }) => (
        <TruncatedCell value={String(row.original.inputData[schemaColumn.id] ?? "")} />
      ),
      size: 200,
    }))

    const outputColDefs: ColumnDef<ResultRow>[] = outputKeys.map((outputKey) => ({
      id: `output_${outputKey}`,
      accessorFn: (row: ResultRow) => String(row.agentRawOutput[outputKey] ?? ""),
      header: ({ column }) => (
        <SortableFilterableHeader
          column={column}
          label={outputKey}
          badge="output"
          badgeProps={{ variant: "outline", className: "border-primary text-primary" }}
          className="text-semibold text-inherit"
        />
      ),
      cell: ({ row }) => (
        <TruncatedCell
          value={String(row.original.agentRawOutput[outputKey] ?? "")}
          className="font-mono text-sm"
        />
      ),
      size: 200,
    }))

    const allColumns: ColumnDef<ResultRow>[] = [
      indexColumn,
      statusColumn,
      ...outputColDefs,
      ...inputColDefs,
    ]

    if (hasErrors) {
      allColumns.push({
        id: "errorDetails",
        accessorFn: (row: ResultRow) => row.errorDetails ?? "",
        header: ({ column }) => (
          <SortableFilterableHeader
            column={column}
            label={t("agentCsvExtractionRun:results.errorDetails")}
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

    allColumns.push({
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
    })

    return allColumns
  }, [inputColumns, outputKeys, hasErrors, t])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, pagination },
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: handleColumnFiltersChange,
    onPaginationChange: setPagination,
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
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle>{t("agentCsvExtractionRun:results.title")}</CardTitle>
      </CardHeader>
      {isLoading ? (
        <Loader />
      ) : (
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
                        <div className="flex flex-col items-center gap-2">
                          <Spinner className="size-5" />
                          <span>{t("agentCsvExtractionRun:results.processing")}</span>
                        </div>
                      ) : (
                        t("agentCsvExtractionRun:results.noRecords")
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
                setPagination((prev) => ({ ...prev, pageIndex: newPageIndex }))
              }
            />
          )}
        </CardContent>
      )}
    </Card>
  )
}
