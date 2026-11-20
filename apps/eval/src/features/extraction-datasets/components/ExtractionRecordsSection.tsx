import type {
  ExtractionDatasetOutputDto,
  ExtractionDatasetParamsDto,
} from "@caseai-connect/eval-contracts"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { SearchIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { DataTable } from "@/components/shared/DataTable"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { COLUMN_ROLE_LABELS, columnsOf } from "@/lib/extraction-columns"
import { extractionDatasetRecordsQueryOptions } from "../api/queries"
import { extractionRecordColumnsOf } from "./extraction-record-columns"

export type ExtractionRecordsSectionProps = {
  dataset: ExtractionDatasetOutputDto
  datasetParams: ExtractionDatasetParamsDto
}

/**
 * All the records of a dataset, however many: a row of its file each, with the columns the
 * dataset keeps. A search narrows them, and a column's header sorts them.
 */
export function ExtractionRecordsSection({
  dataset,
  datasetParams,
}: ExtractionRecordsSectionProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { t, i18n } = useLingui()
  const { data: records } = useSuspenseQuery(extractionDatasetRecordsQueryOptions(datasetParams))
  const [search, setSearch] = useState("")
  // The same columns from one render to the next: the table reads new ones as a new table.
  const columns = useMemo(
    () =>
      extractionRecordColumnsOf({
        // A column left out of the dataset holds nothing an evaluation reads.
        columns: columnsOf(dataset).filter((column) => column.role !== "ignore"),
        roleLabelOf: (column) => i18n._(COLUMN_ROLE_LABELS[column.role]),
      }),
    [dataset, i18n],
  )
  const table = useReactTable({
    data: records,
    columns,
    state: { globalFilter: search },
    onGlobalFilterChange: setSearch,
    getRowId: (record) => record.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })
  const recordCount = records.length
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">
            <Trans comment="The title of the records of a dataset">Records</Trans>
          </h2>
          <p className="text-sm text-muted-foreground">
            <Plural value={recordCount} _0="No record" one="# record" other="# records" />
          </p>
        </div>
        <InputGroup className="w-full sm:w-72">
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t`Search the records`}
            aria-label={t`Search the records`}
          />
        </InputGroup>
      </div>
      <DataTable
        table={table}
        empty={
          recordCount === 0 ? (
            <Trans>This dataset has no record.</Trans>
          ) : (
            <Trans>No record matches this search.</Trans>
          )
        }
      />
    </section>
  )
}
