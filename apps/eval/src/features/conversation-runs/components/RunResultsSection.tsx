import type {
  ConversationRunOutputDto,
  ConversationRunRecordOutputDto,
} from "@bayes-platform/eval-contracts"
import { Plural, Trans, useLingui } from "@lingui/react/macro"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { useMemo, useState } from "react"
import { DataTable } from "@/components/shared/DataTable"
import { ResultFilters } from "@/components/shared/ResultFilters"
import { RunProgressNote } from "@/components/shared/RunProgressNote"
import { isRunActive } from "@/lib/run-status"
import {
  filterResults,
  RESULT_FILTER_LABELS,
  RESULT_FILTERS,
  type ResultFilter,
  shownResultFilterOf,
} from "../result-filters"
import { conversationRunRecordColumnsOf } from "./conversation-run-record-columns"
import { RunRecordSheet } from "./RunRecordSheet"

export type RunResultsSectionProps = {
  /** The run: where it stands and its figures word an empty table. */
  run: ConversationRunOutputDto
  results: ConversationRunRecordOutputDto[]
  /** The filter the URL names, which narrows the results. */
  filter: string | undefined
  onFilterChange: (filter: ResultFilter) => void
}

/**
 * The results of a run: its records, each cut to a few lines, with filters that narrow them to
 * the errors, the low scores or what waits. A row opens its record whole, in a sheet.
 */
export function RunResultsSection({
  run,
  results,
  filter,
  onFilterChange,
}: RunResultsSectionProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const { t, i18n } = useLingui()
  const [openRecordId, setOpenRecordId] = useState<string | null>(null)
  // The filters that keep something: a run with no error offers no Errors filter.
  const filters = RESULT_FILTERS.filter(
    (candidate) => candidate === "all" || filterResults(results, candidate).length > 0,
  )
  // A filter that keeps nothing any more, as a run under way moves on, gives way to All.
  const activeFilter = shownResultFilterOf(results, filter)
  // The same list from one render to the next: the table reads a new list as new data, and one
  // made at each render sends it into a loop of renders.
  const shown = useMemo(() => filterResults(results, activeFilter), [results, activeFilter])
  // From the results, so the open record follows a run under way as it gets its answer.
  const openRecord = results.find((record) => record.id === openRecordId) ?? null
  const recordCount = results.length
  const table = useReactTable({
    data: shown,
    columns: conversationRunRecordColumnsOf({
      translate: (descriptor) => i18n._(descriptor),
      // The column shows once a record has a form, filled or not.
      hasFormState: results.some((record) => record.formState !== null),
      openLabel: (record) => {
        const input = record.input
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
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">
            <Trans comment="The title of the records of a run">Results</Trans>
          </h2>
          <p className="text-sm text-muted-foreground">
            <Plural value={recordCount} _0="No record" one="# record" other="# records" />
          </p>
        </div>
        <ResultFilters
          filters={filters.map((candidate) => ({
            value: candidate,
            label: i18n._(RESULT_FILTER_LABELS[candidate]),
            count: filterResults(results, candidate).length,
          }))}
          value={activeFilter}
          onChange={onFilterChange}
        />
      </div>
      <DataTable
        table={table}
        onRowOpen={(row) => setOpenRecordId(row.original.id)}
        openRowId={openRecordId}
        empty={
          isRunActive(run.status) ? (
            <RunProgressNote summary={run.summary} />
          ) : run.status === "failed" ? (
            <Trans>This run failed before it asked a record.</Trans>
          ) : (
            <Trans>This run has no record yet.</Trans>
          )
        }
      />
      <RunRecordSheet record={openRecord} onClose={() => setOpenRecordId(null)} />
    </section>
  )
}
