import type {
  CsvColumnDto,
  CsvExtractionRecordOutputDto,
  CsvExtractionRecordsOutputDto,
} from "@caseai-connect/desk-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { getCoreRowModel, type SortingState, useReactTable } from "@tanstack/react-table"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { DataTable } from "@/components/shared/DataTable"
import { Button } from "@/components/ui/button"
import { CSV_RECORDS_PAGE_SIZE } from "../api/queries"
import { fieldKeysOf } from "../extraction-fields"
import type { CsvRecordsPage } from "../schemas"
import { recordColumnsOf } from "./csv-record-columns"

export type CsvRecordsTableProps = {
  records: CsvExtractionRecordsOutputDto
  page: CsvRecordsPage
  fileColumns: CsvColumnDto[]
  isRefreshing: boolean
  isLive: boolean
  openRecordId: string | null
  onPageChange: (page: CsvRecordsPage) => void
  onOpenRecord: (record: CsvExtractionRecordOutputDto) => void
}

/**
 * The rows of a CSV run, a page at a time, sorted by the API: a click on a header sorts by it,
 * a click on a row opens it in full.
 */
export function CsvRecordsTable({
  records,
  page,
  fileColumns,
  isRefreshing,
  isLive,
  openRecordId,
  onPageChange,
  onOpenRecord,
}: CsvRecordsTableProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { t, i18n } = useLingui()
  const answerFields = fieldKeysOf(records.records.map((record) => record.agentRawOutput))
  const columns = recordColumnsOf({
    answerFields,
    fileColumns,
    translate: (descriptor) => i18n._(descriptor),
    openLabel: (rowNumber) => t`Open row ${rowNumber}`,
  })
  const sorting: SortingState = page.sortBy
    ? [{ id: page.sortBy, desc: page.sortOrder === "desc" }]
    : []
  const table = useReactTable({
    data: records.records,
    columns,
    getRowId: (record) => record.id,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    state: { sorting },
    onSortingChange: (updater) => {
      const [next] = typeof updater === "function" ? updater(sorting) : updater
      onPageChange(
        next ? { page: 0, sortBy: next.id, sortOrder: next.desc ? "desc" : "asc" } : { page: 0 },
      )
    },
  })

  const first = records.total === 0 ? 0 : records.page * CSV_RECORDS_PAGE_SIZE + 1
  const last = Math.min(records.total, (records.page + 1) * CSV_RECORDS_PAGE_SIZE)
  const total = records.total
  const hasNext = last < records.total

  return (
    <section aria-labelledby="csv-results" className="flex flex-col gap-2">
      <h2 id="csv-results" className="px-1 text-sm font-medium">
        <Trans>Results</Trans>
      </h2>
      <DataTable
        table={table}
        isRefreshing={isRefreshing}
        openRowId={openRecordId}
        onRowOpen={(row) => onOpenRecord(row.original)}
        empty={isLive ? <Trans>The first rows come in a moment…</Trans> : <Trans>No rows</Trans>}
      />
      {records.total > 0 ? (
        <nav
          aria-label={t`Pages of the results`}
          className="flex items-center justify-between gap-2 px-1 text-sm text-muted-foreground"
        >
          <span className="tabular-nums">
            <Trans>
              Rows {first}–{last} of {total}
            </Trans>
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t`Previous page`}
              disabled={records.page === 0}
              onClick={() => onPageChange({ ...page, page: Math.max(0, records.page - 1) })}
            >
              <ChevronLeftIcon aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t`Next page`}
              disabled={!hasNext}
              onClick={() => onPageChange({ ...page, page: records.page + 1 })}
            >
              <ChevronRightIcon aria-hidden />
            </Button>
          </div>
        </nav>
      ) : null}
    </section>
  )
}
