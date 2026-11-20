import {
  EXTRACTION_RUN_RECORDS_PAGE_SIZE,
  type ExtractionDatasetOutputDto,
  type ExtractionRunOutputDto,
  type ExtractionRunParamsDto,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useQuery } from "@tanstack/react-query"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { DownloadIcon } from "lucide-react"
import { useState } from "react"
import { ColumnFilters } from "@/components/shared/ColumnFilters"
import { DataTable } from "@/components/shared/DataTable"
import { ResultFilters } from "@/components/shared/ResultFilters"
import { RunProgressNote } from "@/components/shared/RunProgressNote"
import { TablePagination } from "@/components/shared/TablePagination"
import { Button } from "@/components/ui/button"
import { cellTextOf, columnsOf, columnsOfRole } from "@/lib/extraction-columns"
import { hasFilters, searchWithFilter, searchWithSort, sortingOf } from "@/lib/records-search"
import { isRunActive } from "@/lib/run-status"
import { extractionRunRecordsQueryOptions } from "../api/queries"
import {
  EXTRACTION_RESULT_FILTER_LABELS,
  EXTRACTION_RESULT_FILTERS,
  resultCountsOf,
  resultFiltersOf,
} from "../result-filters"
import type { ExtractionRunSearch } from "../schemas"
import { ExtractionRecordSheet } from "./ExtractionRecordSheet"
import {
  agentKeyOf,
  ERROR_DETAILS_KEY,
  extractionRunRecordColumnsOf,
  inputKeyOf,
  targetKeyOf,
} from "./extraction-run-record-columns"

export type ExtractionResultsSectionProps = {
  run: ExtractionRunOutputDto
  runParams: ExtractionRunParamsDto
  /** The dataset the run asked: its columns name the values of each record. */
  dataset: ExtractionDatasetOutputDto
  /** Which results show: the page, the order, the search and the filter, from the URL. */
  search: ExtractionRunSearch
  onSearchChange: (search: ExtractionRunSearch) => void
  /** Opens the results as a CSV file, once the run has one; none hides the button. */
  onDownloadCsv: (() => void) | null
}

/**
 * The results of an extraction run, a page at a time: its records, each cut to a few lines. The
 * API pages, sorts and searches them, as a run may hold thousands: filters narrow them to the
 * mismatches, the errors or what waits, a column's header sorts by it, and the search looks for a
 * text in one column. A row opens its record whole, in a sheet. A run that is over offers its
 * results as a CSV file, beside the filters.
 */
export function ExtractionResultsSection({
  run,
  runParams,
  dataset,
  search,
  onSearchChange,
  onDownloadCsv,
}: ExtractionResultsSectionProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { t, i18n } = useLingui()
  const [openRecordId, setOpenRecordId] = useState<string | null>(null)
  const { result, ...recordsSearch } = search
  const page = recordsSearch.page ?? 0
  const counts = resultCountsOf(run)
  // The filters that keep something: a run with no error offers no Errors filter.
  const filters = EXTRACTION_RESULT_FILTERS.filter(
    (candidate) => candidate === "all" || counts[candidate] > 0,
  )
  // A filter that keeps nothing any more, as a run under way moves on, gives way to All.
  const activeFilter = result && filters.includes(result) ? result : "all"
  // useQuery: another page, order, search or filter keeps the rows shown until its own arrive.
  const results = useQuery(
    extractionRunRecordsQueryOptions(runParams, recordsSearch, {
      filters: resultFiltersOf(activeFilter),
      isActive: isRunActive(run.status),
    }),
  )
  const records = results.data?.records ?? NO_RECORD
  // From the page shown, so the open record follows a run under way as it gets its values.
  const openRecord = records.find((record) => record.id === openRecordId) ?? null
  const inputColumns = columnsOfRole(dataset, "input")
  const columnNameOf = (columnId: string) => dataset.schemaMapping[columnId]?.finalName ?? columnId
  const [firstInput] = inputColumns
  const sorting = sortingOf(recordsSearch)
  const table = useReactTable({
    data: records,
    columns: extractionRunRecordColumnsOf({
      translate: (descriptor) => i18n._(descriptor),
      firstRowNumber: page * EXTRACTION_RUN_RECORDS_PAGE_SIZE + 1,
      inputColumns,
      keyMapping: run.keyMapping,
      columnNameOf,
      hasErrorDetails: records.some((record) => record.errorDetails),
      openLabel: (record) => {
        const input = firstInput ? cellTextOf(record.datasetRecordData?.[firstInput.id]) : ""
        return t`Open the result of: ${input}`
      },
      onOpen: (record) => setOpenRecordId(record.id),
    }),
    getRowId: (record) => record.id,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    manualFiltering: true,
    state: { sorting },
    onSortingChange: (updater) =>
      onSearchChange({
        ...searchWithSort(
          recordsSearch,
          typeof updater === "function" ? updater(sorting) : updater,
        ),
        result,
      }),
  })
  // What the API can look in: what the agent read, what it returned, and what it should return.
  const searchColumns = [
    ...inputColumns.map((column) => ({ id: inputKeyOf(column.id), label: column.finalName })),
    ...run.keyMapping.map((entry) => {
      const field = entry.agentOutputKey
      return { id: agentKeyOf(field), label: t`${field}, agent's value` }
    }),
    ...run.keyMapping.flatMap((entry) => {
      const field = entry.agentOutputKey
      return entry.mode === "scored"
        ? [{ id: targetKeyOf(field), label: t`${field}, value expected` }]
        : []
    }),
    { id: ERROR_DETAILS_KEY, label: t`Error details` },
  ]
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          <Trans comment="The title of the records of a run">Results</Trans>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <ResultFilters
            filters={filters.map((candidate) => ({
              value: candidate,
              label: i18n._(EXTRACTION_RESULT_FILTER_LABELS[candidate]),
              count: counts[candidate],
            }))}
            value={activeFilter}
            onChange={(next) =>
              onSearchChange({
                ...recordsSearch,
                page: undefined,
                result: next === "all" ? undefined : next,
              })
            }
          />
          {onDownloadCsv ? (
            <Button variant="outline" size="sm" onClick={onDownloadCsv}>
              <DownloadIcon data-icon="inline-start" aria-hidden />
              <Trans comment="Opens the results of a run as a CSV file">Download CSV</Trans>
            </Button>
          ) : null}
        </div>
      </div>
      <ColumnFilters
        columns={searchColumns}
        filters={recordsSearch.filters ?? {}}
        onFilter={(column, text) =>
          onSearchChange({ ...searchWithFilter(recordsSearch, column, text), result })
        }
      />
      <DataTable
        table={table}
        isRefreshing={results.isPlaceholderData}
        onRowOpen={(row) => setOpenRecordId(row.original.id)}
        openRowId={openRecordId}
        empty={
          results.isPending ? (
            <Trans>Loading the results…</Trans>
          ) : results.isError ? (
            <Trans>The results could not load. Try again.</Trans>
          ) : hasFilters(recordsSearch) ? (
            <Trans>No result passes these filters.</Trans>
          ) : isRunActive(run.status) ? (
            <RunProgressNote summary={run.summary} />
          ) : run.status === "failed" ? (
            <Trans>This run failed before it asked a record.</Trans>
          ) : (
            <Trans>This run has no record yet.</Trans>
          )
        }
      />
      <TablePagination
        page={page}
        pageSize={EXTRACTION_RUN_RECORDS_PAGE_SIZE}
        total={results.data?.total ?? 0}
        onPageChange={(page) => onSearchChange({ ...search, page })}
      />
      <ExtractionRecordSheet
        record={openRecord}
        shownColumns={columnsOf(dataset).filter(
          (column) => column.role === "input" || column.role === "reference",
        )}
        keyMapping={run.keyMapping}
        columnNameOf={columnNameOf}
        onClose={() => setOpenRecordId(null)}
      />
    </section>
  )
}

/** The rows of a table whose page has not arrived: the same list from one render to the next. */
const NO_RECORD: never[] = []
