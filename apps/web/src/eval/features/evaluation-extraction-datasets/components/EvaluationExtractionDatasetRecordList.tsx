import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@caseai-connect/ui/shad/card"
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
  EvaluationExtractionDatasetRecordRow,
} from "@/eval/features/evaluation-extraction-datasets/evaluation-extraction-datasets.models"
import { selectRecordsData } from "@/eval/features/evaluation-extraction-datasets/evaluation-extraction-datasets.selectors"
import { evaluationExtractionDatasetsActions } from "@/eval/features/evaluation-extraction-datasets/evaluation-extraction-datasets.slice"

export function EvaluationExtractionDatasetRecordList({
  dataset,
}: {
  dataset: EvaluationExtractionDataset
}) {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const recordsData = useAppSelector(selectRecordsData)

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
        evaluationExtractionDatasetsActions.listRecords({
          datasetId: dataset.id,
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
    [dispatch, dataset.id],
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
        <CardTitle>{t("evaluation:dataset.records.view.title")}</CardTitle>
        <CardDescription>
          {t("evaluation:dataset.records.view.description", { count: total })}
        </CardDescription>
      </CardHeader>
      {isLoading ? (
        <Loader />
      ) : (
        <RecordsTable
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
  dataset: EvaluationExtractionDataset
  records: EvaluationExtractionDatasetRecordRow[]
  total: number
  sorting: SortingState
  columnFilters: ColumnFiltersState
  pagination: PaginationState
  onSortingChange: OnChangeFn<SortingState>
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>
  onPaginationChange: OnChangeFn<PaginationState>
}

function RecordsTable({
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
  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE))

  const schemaColumns = useMemo(
    () =>
      Object.values(dataset.schemaMapping).sort(
        (columnA, columnB) => columnA.index - columnB.index,
      ),
    [dataset.schemaMapping],
  )

  const columns = useMemo<ColumnDef<EvaluationExtractionDatasetRecordRow>[]>(
    () => [
      {
        id: "__index",
        header: ({ table }) => table.getRowCount(),
        cell: ({ row, table }) => (
          <span className="font-mono text-xs text-muted-foreground/60 select-none">
            {table.getState().pagination.pageIndex * DEFAULT_PAGE_SIZE + row.index + 1}
          </span>
        ),
        size: 48,
        enableSorting: false,
        enableColumnFilter: false,
      },
      ...schemaColumns.map(
        (schemaColumn): ColumnDef<EvaluationExtractionDatasetRecordRow> => ({
          id: schemaColumn.id,
          accessorFn: (row) => String(row.data[schemaColumn.id] ?? ""),
          header: ({ column }) => (
            <SortableFilterableHeader
              column={column}
              label={schemaColumn.finalName}
              badge={schemaColumn.role}
            />
          ),
          cell: ({ row }) => (
            <TruncatedCell value={String(row.original.data[schemaColumn.id] ?? "")} />
          ),
          size: 200,
        }),
      ),
    ],
    [schemaColumns],
  )

  const table = useReactTable({
    data: records,
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
          <thead className="bg-muted/50 sticky top-0 z-10 [&_tr]:border-b">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b transition-colors">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="text-foreground h-auto px-2 py-2 text-left align-bottom font-medium whitespace-nowrap"
                    style={
                      header.column.id === "__index"
                        ? { width: 48 }
                        : { width: 200, minWidth: 120, maxWidth: 400 }
                    }
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
                <td colSpan={columns.length} className="h-24 text-center text-muted-foreground p-2">
                  {t("status:noResults")}
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
                      className="p-2 align-middle whitespace-nowrap"
                      style={
                        cell.column.id === "__index" ? undefined : { width: 200, maxWidth: 400 }
                      }
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
