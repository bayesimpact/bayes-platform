import {
  EXTRACTION_DATASET_RECORDS_PAGE_SIZE,
  type ExtractionDatasetOutputDto,
  type ExtractionDatasetParamsDto,
} from "@caseai-connect/eval-contracts"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { useQuery } from "@tanstack/react-query"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { useState } from "react"
import { ColumnFilters } from "@/components/shared/ColumnFilters"
import { DataTable } from "@/components/shared/DataTable"
import { TablePagination } from "@/components/shared/TablePagination"
import { COLUMN_ROLE_LABELS, columnsOf } from "@/lib/extraction-columns"
import {
  hasFilters,
  type RecordsSearch,
  searchWithFilter,
  searchWithSort,
  sortingOf,
} from "@/lib/records-search"
import { extractionDatasetRecordsQueryOptions } from "../api/queries"
import { ExtractionDatasetRecordSheet } from "./ExtractionDatasetRecordSheet"
import { extractionRecordColumnsOf } from "./extraction-record-columns"

export type ExtractionRecordsSectionProps = {
  dataset: ExtractionDatasetOutputDto
  datasetParams: ExtractionDatasetParamsDto
  /** Which records show: the page, the order and the filters, from the URL. */
  search: RecordsSearch
  onSearchChange: (search: RecordsSearch) => void
}

/**
 * The records of a dataset, a page at a time: a row of its file each, with every column of the
 * dataset and its role. The API pages, sorts and filters them, as a dataset may hold thousands: a
 * column's header sorts by it, and each filter looks for a text in one column, several at once.
 * A row opens its record whole, in a sheet.
 */
export function ExtractionRecordsSection({
  dataset,
  datasetParams,
  search,
  onSearchChange,
}: ExtractionRecordsSectionProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { t, i18n } = useLingui()
  const [openRecordId, setOpenRecordId] = useState<string | null>(null)
  // useQuery: another page, order or filter keeps the rows shown until its own arrive.
  const records = useQuery(extractionDatasetRecordsQueryOptions(datasetParams, search))
  const rows = records.data?.records ?? NO_RECORD
  const columns = columnsOf(dataset)
  const roleLabelOf = (column: (typeof columns)[number]) => i18n._(COLUMN_ROLE_LABELS[column.role])
  const page = search.page ?? 0
  const sorting = sortingOf(search)
  const table = useReactTable({
    data: rows,
    columns: extractionRecordColumnsOf({
      columns,
      firstRowNumber: page * EXTRACTION_DATASET_RECORDS_PAGE_SIZE + 1,
      roleLabelOf,
      openLabel: (rowNumber) => t`Open the record of row ${rowNumber}`,
      onOpen: (record) => setOpenRecordId(record.id),
    }),
    getRowId: (record) => record.id,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    manualFiltering: true,
    state: { sorting },
    onSortingChange: (updater) =>
      onSearchChange(
        searchWithSort(search, typeof updater === "function" ? updater(sorting) : updater),
      ),
  })
  const recordCount = dataset.recordCount
  const foundCount = records.data?.total ?? 0
  const isFiltering = hasFilters(search)
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">
          <Trans comment="The title of the records of a dataset">Records</Trans>
        </h2>
        <p className="text-sm text-muted-foreground">
          {isFiltering && records.data ? (
            <Plural
              value={foundCount}
              _0="No record passes the filters"
              one="# record passes the filters"
              other="# records pass the filters"
            />
          ) : (
            <Plural value={recordCount} _0="No record" one="# record" other="# records" />
          )}
        </p>
      </div>
      <ColumnFilters
        columns={columns.map((column) => ({ id: column.id, label: column.finalName }))}
        filters={search.filters ?? {}}
        onFilter={(column, text) => onSearchChange(searchWithFilter(search, column, text))}
      />
      <DataTable
        table={table}
        isRefreshing={records.isPlaceholderData}
        onRowOpen={(row) => setOpenRecordId(row.original.id)}
        openRowId={openRecordId}
        empty={
          records.isPending ? (
            <Trans>Loading the records…</Trans>
          ) : records.isError ? (
            <Trans>The records could not load. Try again.</Trans>
          ) : isFiltering ? (
            <Trans>No record passes these filters.</Trans>
          ) : (
            <Trans>This dataset has no record.</Trans>
          )
        }
      />
      <TablePagination
        page={page}
        pageSize={EXTRACTION_DATASET_RECORDS_PAGE_SIZE}
        total={foundCount}
        onPageChange={(next) => onSearchChange({ ...search, page: next })}
      />
      <ExtractionDatasetRecordSheet
        record={rows.find((record) => record.id === openRecordId) ?? null}
        columns={columns}
        roleLabelOf={roleLabelOf}
        onClose={() => setOpenRecordId(null)}
      />
    </section>
  )
}

/** The rows of a table whose page has not arrived: the same list from one render to the next. */
const NO_RECORD: never[] = []
