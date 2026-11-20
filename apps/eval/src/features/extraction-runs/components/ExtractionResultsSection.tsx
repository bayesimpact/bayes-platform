import type {
  ExtractionDatasetOutputDto,
  ExtractionRunOutputDto,
  ExtractionRunRecordOutputDto,
} from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { useMemo, useState } from "react"
import { DataTable } from "@/components/shared/DataTable"
import { ResultFilters } from "@/components/shared/ResultFilters"
import { cellTextOf, columnsOf, columnsOfRole } from "@/lib/extraction-columns"
import {
  EXTRACTION_RESULT_FILTER_LABELS,
  EXTRACTION_RESULT_FILTERS,
  type ExtractionResultFilter,
  filterExtractionResults,
} from "../result-filters"
import { ExtractionRecordSheet } from "./ExtractionRecordSheet"
import { extractionRunRecordColumnsOf } from "./extraction-run-record-columns"

export type ExtractionResultsSectionProps = {
  run: ExtractionRunOutputDto
  /** The dataset the run asked: its columns name the values of each record. */
  dataset: ExtractionDatasetOutputDto
  results: ExtractionRunRecordOutputDto[]
}

/**
 * The results of an extraction run: its records, each cut to a few lines, with filters that
 * narrow them to the mismatches, the errors or what waits. A row opens its record whole, in a
 * sheet.
 */
export function ExtractionResultsSection({ run, dataset, results }: ExtractionResultsSectionProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { t, i18n } = useLingui()
  const [filter, setFilter] = useState<ExtractionResultFilter>("all")
  const [openRecordId, setOpenRecordId] = useState<string | null>(null)
  // The filters that keep something: a run with no error offers no Errors filter.
  const filters = EXTRACTION_RESULT_FILTERS.filter(
    (candidate) => candidate === "all" || filterExtractionResults(results, candidate).length > 0,
  )
  // A filter that keeps nothing any more, as a run under way moves on, gives way to All.
  const activeFilter = filters.includes(filter) ? filter : "all"
  // The same list from one render to the next: the table reads a new list as new data, and one
  // made at each render sends it into a loop of renders.
  const shown = useMemo(
    () => filterExtractionResults(results, activeFilter),
    [results, activeFilter],
  )
  // From the results, so the open record follows a run under way as it gets its values.
  const openRecord = results.find((record) => record.id === openRecordId) ?? null
  const inputColumns = columnsOfRole(dataset, "input")
  const [firstInput] = inputColumns
  const table = useReactTable({
    data: shown,
    columns: extractionRunRecordColumnsOf({
      translate: (descriptor) => i18n._(descriptor),
      inputColumns,
      keyMapping: run.keyMapping,
      expectedLabel: (expected) => t`Expected: ${expected}`,
      openLabel: (record) => {
        const input = firstInput ? cellTextOf(record.datasetRecordData?.[firstInput.id]) : ""
        return t`Open the result of: ${input}`
      },
      onOpen: (record) => setOpenRecordId(record.id),
    }),
    getRowId: (record) => record.id,
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          <Trans comment="The title of the records of a run">Results</Trans>
        </h2>
        <ResultFilters
          filters={filters.map((candidate) => ({
            value: candidate,
            label: i18n._(EXTRACTION_RESULT_FILTER_LABELS[candidate]),
            count: filterExtractionResults(results, candidate).length,
          }))}
          value={activeFilter}
          onChange={setFilter}
        />
      </div>
      <DataTable
        table={table}
        onRowOpen={(row) => setOpenRecordId(row.original.id)}
        openRowId={openRecordId}
        empty={
          run.status === "failed" ? (
            <Trans>This run failed before it asked a record.</Trans>
          ) : (
            <Trans>This run has no record yet.</Trans>
          )
        }
      />
      <ExtractionRecordSheet
        record={openRecord}
        shownColumns={columnsOf(dataset).filter(
          (column) => column.role === "input" || column.role === "reference",
        )}
        keyMapping={run.keyMapping}
        columnNameOf={(columnId) => dataset.schemaMapping[columnId]?.finalName ?? columnId}
        onClose={() => setOpenRecordId(null)}
      />
    </section>
  )
}
