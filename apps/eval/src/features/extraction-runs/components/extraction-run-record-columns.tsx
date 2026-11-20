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
import { cellTextOf } from "@/lib/extraction-columns"
import { RecordStatusBadge } from "./RecordStatusBadge"

const columnHelper = createColumnHelper<ExtractionRunRecordOutputDto>()

/** The texts of the headers, which the table translates. */
const recordColumnLabels = {
  status: msg({ message: "Result", comment: "Where a record of an extraction run stands" }),
} satisfies Record<string, MessageDescriptor>

/** A record's text in a cell: three lines at most, which the record's sheet shows whole. */
const TEXT_CLASSES = "line-clamp-3 min-w-40 whitespace-pre-wrap wrap-anywhere"

/**
 * The columns of an extraction run's records: where each stands, what the agent read, then one
 * column per field the run reads, with what the agent returned, a mark that says whether it is
 * the value expected, and that value under it when it differs. The first input opens the record's
 * sheet, for the keyboard: a click anywhere on the row does too.
 */
export function extractionRunRecordColumnsOf({
  translate,
  inputColumns,
  keyMapping,
  expectedLabel,
  openLabel,
  onOpen,
}: {
  translate: (descriptor: MessageDescriptor) => string
  /** The columns of the dataset the agent reads. */
  inputColumns: ExtractionDatasetColumnDto[]
  /** The fields the run reads, compared or only shown. */
  keyMapping: ExtractionRunKeyMappingEntryDto[]
  /** The value a field should have, said in a sentence, under a value that differs. */
  expectedLabel: (expected: string) => string
  /** The name of the button that opens a record, for a screen reader. */
  openLabel: (record: ExtractionRunRecordOutputDto) => string
  onOpen: (record: ExtractionRunRecordOutputDto) => void
}): ColumnDef<ExtractionRunRecordOutputDto, unknown>[] {
  // Safe: each helper call types its own value, and the list holds them as columns of any value.
  return [
    columnHelper.display({
      id: "status",
      header: translate(recordColumnLabels.status),
      cell: (context) => <RecordStatusBadge status={context.row.original.status} />,
    }),
    ...inputColumns.map((column, index) =>
      columnHelper.accessor((record) => cellTextOf(record.datasetRecordData?.[column.id]), {
        id: `input-${column.id}`,
        header: column.finalName,
        enableSorting: false,
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
              {context.getValue()}
            </button>
          ) : (
            <p className={TEXT_CLASSES}>{context.getValue()}</p>
          ),
      }),
    ),
    ...keyMapping.map((entry) =>
      columnHelper.display({
        id: `field-${entry.agentOutputKey}`,
        header: () => <span className="font-mono">{entry.agentOutputKey}</span>,
        cell: (context) => {
          const field = context.row.original.comparison?.[entry.agentOutputKey]
          if (!field) return <span className="text-muted-foreground">–</span>
          const value = cellTextOf(field.agentValue)
          if (field.status === "fyi") {
            return <p className={cn(TEXT_CLASSES, "text-muted-foreground")}>{value || "–"}</p>
          }
          const isMatch = field.status === "match"
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
              <div className="flex min-w-0 flex-col gap-0.5">
                <p
                  className={cn(
                    "line-clamp-3 whitespace-pre-wrap wrap-anywhere",
                    !isMatch && "text-destructive",
                  )}
                >
                  {value || "–"}
                </p>
                {isMatch ? null : (
                  <p className="line-clamp-2 text-xs wrap-anywhere text-muted-foreground">
                    {expectedLabel(cellTextOf(field.groundTruth))}
                  </p>
                )}
              </div>
            </div>
          )
        },
      }),
    ),
  ] as ColumnDef<ExtractionRunRecordOutputDto, unknown>[]
}
