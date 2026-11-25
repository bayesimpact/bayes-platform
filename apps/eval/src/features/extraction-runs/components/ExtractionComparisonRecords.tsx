import {
  type AgentParamsDto,
  EXTRACTION_RUN_RECORDS_PAGE_SIZE,
  type ExtractionRunOutputDto,
} from "@bayes-platform/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { type ColumnDef, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { ComparedRunHead } from "@/components/shared/ComparedRunHead"
import { DataTable } from "@/components/shared/DataTable"
import { rowNumberColumnOf } from "@/components/shared/row-number-column"
import { TableLoadError } from "@/components/shared/TableLoadError"
import { TableLoadingRows } from "@/components/shared/TableLoadingRows"
import { TablePagination } from "@/components/shared/TablePagination"
import type { ExtractionComparisonRow } from "../comparison"
import { matchedFieldsOf } from "../key-mapping"
import { RecordStatusBadge } from "./RecordStatusBadge"

export type ExtractionComparisonRecordsProps = {
  agentParams: AgentParamsDto
  datasetId: string
  /** The runs compared, in the order the person picked them: a column each. */
  runs: ExtractionRunOutputDto[]
  /** A row per record of the page: the same list while the runs hold the same records. */
  rows: ExtractionComparisonRow[]
  /** The page of the records, counted from 0. */
  page: number
  onPageChange: (page: number) => void
  /** How many records the run that asked the most holds. */
  recordTotal: number
  isLoading: boolean
  /** Whether the records of a run could not load. */
  hasFailed: boolean
  /** Reads again the records that could not load. */
  onRetry: () => void
  /** Whether the runs did not ask the same number of records: their pages may not line up. */
  isUneven: boolean
}

/**
 * The records of the runs compared, a page of them, one row each: what names the record, then
 * where it stands in each run, with how many of its compared fields match.
 */
export function ExtractionComparisonRecords({
  agentParams,
  datasetId,
  runs,
  rows,
  page,
  onPageChange,
  recordTotal,
  isLoading,
  hasFailed,
  onRetry,
  isUneven,
}: ExtractionComparisonRecordsProps) {
  // The table of TanStack Table v8 changes in place, which the React Compiler cannot memoize.
  "use no memo"
  const columns: ColumnDef<ExtractionComparisonRow>[] = [
    rowNumberColumnOf<ExtractionComparisonRow>(page * EXTRACTION_RUN_RECORDS_PAGE_SIZE + 1),
    {
      id: "record",
      header: () => (
        <Trans comment="The header of the column of the records compared">Record</Trans>
      ),
      cell: ({ row }) => (
        <p
          title={row.original.label}
          className="line-clamp-2 max-w-96 min-w-40 whitespace-normal wrap-anywhere"
        >
          {row.original.label || "–"}
        </p>
      ),
    },
    ...runs.map(
      (run): ColumnDef<ExtractionComparisonRow> => ({
        id: run.id,
        header: () => (
          <ComparedRunHead
            agentParams={agentParams}
            datasetId={datasetId}
            run={run}
            revision={run.agentRevision}
          />
        ),
        cell: ({ row }) => {
          const record = row.original.byRunId[run.id]
          if (!record) return <span className="text-muted-foreground">–</span>
          const fields = matchedFieldsOf(record.comparison)
          const matched = fields?.matched ?? 0
          const scored = fields?.scored ?? 0
          return (
            <div className="flex flex-wrap items-center gap-2">
              <RecordStatusBadge status={record.status} />
              {scored > 0 ? (
                <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                  <Trans comment="Beside a record in the comparison of runs: its compared fields that match, out of all of them, such as 1 / 2 fields">
                    {matched} / {scored} fields
                  </Trans>
                </span>
              ) : null}
            </div>
          )
        },
        meta: { headerClassName: "h-auto py-2 align-bottom" },
      }),
    ),
  ]
  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.key,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    enableSorting: false,
  })
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">
          <Trans comment="The title of the records of the runs compared">Record by record</Trans>
        </h2>
        <p className="text-sm text-muted-foreground">
          <Trans>
            Where each record stands in each run, with how many of its compared fields match.
          </Trans>
        </p>
        {isUneven ? (
          <p className="text-sm text-muted-foreground">
            <Trans>
              These runs did not ask the same number of records. Each run shows its own page: a dash
              can stand for a record the run shows on another page.
            </Trans>
          </p>
        ) : null}
      </div>
      <DataTable
        table={table}
        empty={
          isLoading ? (
            <TableLoadingRows>
              <Trans>Loading the results…</Trans>
            </TableLoadingRows>
          ) : hasFailed ? (
            <TableLoadError onRetry={onRetry}>
              <Trans>The results could not load.</Trans>
            </TableLoadError>
          ) : (
            <Trans>These runs have no record yet.</Trans>
          )
        }
      />
      <TablePagination
        page={page}
        pageSize={EXTRACTION_RUN_RECORDS_PAGE_SIZE}
        total={recordTotal}
        onPageChange={onPageChange}
      />
    </section>
  )
}
