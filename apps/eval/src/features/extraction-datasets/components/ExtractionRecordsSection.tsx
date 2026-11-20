import {
  EXTRACTION_DATASET_RECORDS_PAGE_SIZE,
  type ExtractionDatasetOutputDto,
  type ExtractionDatasetParamsDto,
} from "@caseai-connect/eval-contracts"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { useQuery } from "@tanstack/react-query"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { ColumnSearch } from "@/components/shared/ColumnSearch"
import { DataTable } from "@/components/shared/DataTable"
import { TablePagination } from "@/components/shared/TablePagination"
import { COLUMN_ROLE_LABELS, columnsOf } from "@/lib/extraction-columns"
import { type RecordsSearch, searchWithSort, sortingOf } from "@/lib/records-search"
import { extractionDatasetRecordsQueryOptions } from "../api/queries"
import { extractionRecordColumnsOf } from "./extraction-record-columns"

export type ExtractionRecordsSectionProps = {
  dataset: ExtractionDatasetOutputDto
  datasetParams: ExtractionDatasetParamsDto
  /** Which records show: the page, the order and the search, from the URL. */
  search: RecordsSearch
  onSearchChange: (search: RecordsSearch) => void
}

/**
 * The records of a dataset, a page at a time: a row of its file each, with the columns the
 * dataset keeps. The API pages, sorts and searches them, as a dataset may hold thousands: a
 * column's header sorts by it, and the search looks for a text in one column.
 */
export function ExtractionRecordsSection({
  dataset,
  datasetParams,
  search,
  onSearchChange,
}: ExtractionRecordsSectionProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { i18n } = useLingui()
  // useQuery: another page, order or search keeps the rows shown until its own arrive.
  const records = useQuery(extractionDatasetRecordsQueryOptions(datasetParams, search))
  // A column left out of the dataset holds nothing an evaluation reads.
  const shownColumns = columnsOf(dataset).filter((column) => column.role !== "ignore")
  const sorting = sortingOf(search)
  const table = useReactTable({
    data: records.data?.records ?? NO_RECORD,
    columns: extractionRecordColumnsOf({
      columns: shownColumns,
      roleLabelOf: (column) => i18n._(COLUMN_ROLE_LABELS[column.role]),
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
  const isSearching = Boolean(search.search)
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">
            <Trans comment="The title of the records of a dataset">Records</Trans>
          </h2>
          <p className="text-sm text-muted-foreground">
            {isSearching && records.data ? (
              <Plural
                value={foundCount}
                _0="No record holds this text"
                one="# record holds this text"
                other="# records hold this text"
              />
            ) : (
              <Plural value={recordCount} _0="No record" one="# record" other="# records" />
            )}
          </p>
        </div>
        <ColumnSearch
          columns={shownColumns.map((column) => ({ id: column.id, label: column.finalName }))}
          value={{ column: search.searchIn, text: search.search ?? "" }}
          onSearch={({ column, text }) =>
            onSearchChange({
              ...search,
              page: undefined,
              searchIn: text ? column : undefined,
              search: text || undefined,
            })
          }
        />
      </div>
      <DataTable
        table={table}
        isRefreshing={records.isPlaceholderData}
        empty={
          records.isPending ? (
            <Trans>Loading the records…</Trans>
          ) : records.isError ? (
            <Trans>The records could not load. Try again.</Trans>
          ) : isSearching ? (
            <Trans>No record matches this search.</Trans>
          ) : (
            <Trans>This dataset has no record.</Trans>
          )
        }
      />
      <TablePagination
        page={search.page ?? 0}
        pageSize={EXTRACTION_DATASET_RECORDS_PAGE_SIZE}
        total={foundCount}
        onPageChange={(page) => onSearchChange({ ...search, page })}
      />
    </section>
  )
}

/** The rows of a table whose page has not arrived: the same list from one render to the next. */
const NO_RECORD: never[] = []
