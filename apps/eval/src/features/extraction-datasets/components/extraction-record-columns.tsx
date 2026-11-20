import type {
  ExtractionDatasetColumnDto,
  ExtractionDatasetRecordOutputDto,
} from "@caseai-connect/eval-contracts"
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table"
import { cn } from "cn"
import { rowNumberColumnOf } from "@/components/shared/row-number-column"
import { Badge } from "@/components/ui/badge"
import { cellTextOf } from "@/lib/extraction-columns"

const columnHelper = createColumnHelper<ExtractionDatasetRecordOutputDto>()

/** A record's text in a cell: three lines at most, which the record's sheet shows whole. */
const TEXT_CLASSES = "line-clamp-3 min-w-40 whitespace-pre-wrap wrap-anywhere"

/**
 * The columns of a dataset's records: the number of the row, then one per column of the dataset,
 * named with its role, each value cut after three lines. A column's id is the dataset column's,
 * which the API sorts by. The first value opens the record's sheet, for the keyboard: a click
 * anywhere on the row does too.
 */
export function extractionRecordColumnsOf({
  columns,
  firstRowNumber,
  roleLabelOf,
  openLabel,
  onOpen,
}: {
  /** The columns of the dataset, in the order of its file. */
  columns: ExtractionDatasetColumnDto[]
  /** The number of the first row of the page shown. */
  firstRowNumber: number
  roleLabelOf: (column: ExtractionDatasetColumnDto) => string
  /** The name of the button that opens a record, for a screen reader. */
  openLabel: (rowNumber: number) => string
  onOpen: (record: ExtractionDatasetRecordOutputDto) => void
}): ColumnDef<ExtractionDatasetRecordOutputDto, unknown>[] {
  // Safe: each helper call types its own value, and the list holds them as columns of any value.
  return [
    rowNumberColumnOf<ExtractionDatasetRecordOutputDto>(firstRowNumber),
    ...columns.map((column, index) =>
      columnHelper.accessor((record) => cellTextOf(record.data[column.id]), {
        id: column.id,
        header: () => (
          <span className="flex items-center gap-1.5">
            {column.finalName}
            <Badge variant="outline" className="font-normal">
              {roleLabelOf(column)}
            </Badge>
          </span>
        ),
        cell: (context) => {
          const text = context.getValue() || "–"
          if (index > 0) return <p className={TEXT_CLASSES}>{text}</p>
          return (
            <button
              type="button"
              aria-label={openLabel(firstRowNumber + context.row.index)}
              // The row opens the record on a click: the button's own click would open it twice.
              onClick={(event) => {
                event.stopPropagation()
                onOpen(context.row.original)
              }}
              className={cn(
                TEXT_CLASSES,
                "cursor-pointer rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              )}
            >
              {text}
            </button>
          )
        },
      }),
    ),
  ] as ColumnDef<ExtractionDatasetRecordOutputDto, unknown>[]
}
