import type {
  ExtractionDatasetColumnDto,
  ExtractionRunKeyMappingEntryDto,
  ExtractionRunRecordOutputDto,
} from "@caseai-connect/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import { CheckIcon, XIcon } from "lucide-react"
import type { ReactNode } from "react"
import { rowNumberColumnOf } from "@/components/shared/row-number-column"
import { Badge } from "@/components/ui/badge"
import { cellTextOf } from "@/lib/extraction-columns"
import { RecordStatusBadge } from "./RecordStatusBadge"

const columnHelper = createColumnHelper<ExtractionRunRecordOutputDto>()

/** The texts of the headers and of their badges, which the table translates. */
const recordColumnLabels = {
  status: msg({ message: "Result", comment: "Where a record of an extraction run stands" }),
  errorDetails: msg({
    message: "Error details",
    comment: "The header of the column of the errors that stopped records of a run",
  }),
  input: msg({ message: "input", comment: "The badge of a column the agent read, in lower case" }),
  target: msg({
    message: "target",
    comment: "The badge of a column that holds the value expected, in lower case",
  }),
  agent: msg({
    message: "agent",
    comment: "The badge of a column that holds what the agent returned, in lower case",
  }),
  match: msg({ message: "Match", comment: "A field of a record that has the value expected" }),
  mismatch: msg({
    message: "Mismatch",
    comment: "A field of a record that differs from the value expected",
  }),
} satisfies Record<string, MessageDescriptor>

/** A record's text in a cell: three lines at most, which the record's sheet shows whole. */
const TEXT_CLASSES = "line-clamp-3 min-w-40 whitespace-pre-wrap wrap-anywhere"

/** The key the API sorts and filters a column of the dataset the agent read by. */
export const inputKeyOf = (columnId: string) => `input_${columnId}`

/** The key the API sorts and filters what the agent returned for a field by. */
export const agentKeyOf = (field: string) => `agent_${field}`

/** The key the API sorts and filters the value a field should have by. */
export const targetKeyOf = (field: string) => `target_${field}`

/** The key the API sorts and filters the error that stopped a record by. */
export const ERROR_DETAILS_KEY = "errorDetails"

/** A header: a name, and a small badge that says what the column holds. */
function headerOf(name: ReactNode, badge: string) {
  return (
    <span className="flex items-center gap-1.5">
      {name}
      <Badge variant="outline" className="font-normal">
        {badge}
      </Badge>
    </span>
  )
}

/**
 * The columns of an extraction run's records: the number of the row, where the record stands,
 * what the agent read, then for each field the run reads the value expected, when the field is
 * compared, and what the agent returned, with a mark that says whether the two match. A column of
 * the errors shows when a record of the page has one. The first input opens the record's sheet,
 * for the keyboard: a click anywhere on the row does too. A column's id is the key the API sorts
 * by, as it sorts the records a page shows.
 */
export function extractionRunRecordColumnsOf({
  translate,
  firstRowNumber,
  inputColumns,
  keyMapping,
  columnNameOf,
  hasErrorDetails,
  openLabel,
  onOpen,
}: {
  translate: (descriptor: MessageDescriptor) => string
  /** The number of the first row of the page shown. */
  firstRowNumber: number
  /** The columns of the dataset the agent reads. */
  inputColumns: ExtractionDatasetColumnDto[]
  /** The fields the run reads, compared or only shown. */
  keyMapping: ExtractionRunKeyMappingEntryDto[]
  /** The name of the dataset's column a field is compared with, by the column's id. */
  columnNameOf: (columnId: string) => string
  /** Whether a record of the page holds an error: the column of the errors then shows. */
  hasErrorDetails: boolean
  /** The name of the button that opens a record, for a screen reader. */
  openLabel: (record: ExtractionRunRecordOutputDto) => string
  onOpen: (record: ExtractionRunRecordOutputDto) => void
}): ColumnDef<ExtractionRunRecordOutputDto, unknown>[] {
  // Safe: each helper call types its own value, and the list holds them as columns of any value.
  return [
    rowNumberColumnOf<ExtractionRunRecordOutputDto>(firstRowNumber),
    columnHelper.accessor("status", {
      header: translate(recordColumnLabels.status),
      cell: (context) => <RecordStatusBadge status={context.getValue()} />,
    }),
    ...inputColumns.map((column, index) =>
      columnHelper.accessor((record) => cellTextOf(record.datasetRecordData?.[column.id]), {
        id: inputKeyOf(column.id),
        header: () => headerOf(column.finalName, translate(recordColumnLabels.input)),
        cell: (context) =>
          index === 0 ? (
            <button
              type="button"
              aria-label={openLabel(context.row.original)}
              // The row opens the record on a click: the button's own click would open it twice.
              onClick={(event) => {
                event.stopPropagation()
                onOpen(context.row.original)
              }}
              className={`${TEXT_CLASSES} cursor-pointer rounded-sm text-left font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50`}
            >
              {context.getValue() || "–"}
            </button>
          ) : (
            <p className={TEXT_CLASSES}>{context.getValue() || "–"}</p>
          ),
      }),
    ),
    ...keyMapping.flatMap((entry) => {
      const field = entry.agentOutputKey
      const agentColumn = columnHelper.accessor(
        (record) => cellTextOf(record.comparison?.[field]?.agentValue),
        {
          id: agentKeyOf(field),
          header: () =>
            headerOf(
              <span className="font-mono">{field}</span>,
              translate(recordColumnLabels.agent),
            ),
          cell: (context) => {
            const result = context.row.original.comparison?.[field]
            if (!result) return <span className="text-muted-foreground">–</span>
            const value = context.getValue() || "–"
            if (result.status === "fyi") {
              return <p className={cn(TEXT_CLASSES, "text-muted-foreground")}>{value}</p>
            }
            const isMatch = result.status === "match"
            const Mark = isMatch ? CheckIcon : XIcon
            return (
              <div className="flex min-w-40 items-start gap-1.5">
                <Mark
                  aria-hidden
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    isMatch ? "text-green-700 dark:text-green-400" : "text-destructive",
                  )}
                />
                <span className="sr-only">
                  {translate(isMatch ? recordColumnLabels.match : recordColumnLabels.mismatch)}
                </span>
                <p
                  className={cn(
                    "line-clamp-3 whitespace-pre-wrap wrap-anywhere",
                    !isMatch && "text-destructive",
                  )}
                >
                  {value}
                </p>
              </div>
            )
          },
        },
      )
      if (entry.mode === "fyi") return [agentColumn]
      return [
        columnHelper.accessor((record) => cellTextOf(record.comparison?.[field]?.groundTruth), {
          id: targetKeyOf(field),
          header: () =>
            headerOf(columnNameOf(entry.datasetColumnId), translate(recordColumnLabels.target)),
          cell: (context) =>
            context.row.original.comparison?.[field] ? (
              <p className={TEXT_CLASSES}>{context.getValue() || "–"}</p>
            ) : (
              <span className="text-muted-foreground">–</span>
            ),
        }),
        agentColumn,
      ]
    }),
    ...(hasErrorDetails
      ? [
          columnHelper.accessor((record) => record.errorDetails ?? "", {
            id: ERROR_DETAILS_KEY,
            header: translate(recordColumnLabels.errorDetails),
            cell: (context) => (
              <p className={cn(TEXT_CLASSES, "text-xs text-destructive")}>{context.getValue()}</p>
            ),
          }),
        ]
      : []),
  ] as ColumnDef<ExtractionRunRecordOutputDto, unknown>[]
}
