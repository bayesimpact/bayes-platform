import type {
  ExtractionDatasetColumnDto,
  ExtractionDatasetRecordOutputDto,
} from "@caseai-connect/eval-contracts"
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { cellTextOf } from "@/lib/extraction-columns"

const columnHelper = createColumnHelper<ExtractionDatasetRecordOutputDto>()

/**
 * The columns of a dataset's records: one per column of the dataset, named with its role, each
 * value cut after three lines.
 */
export function extractionRecordColumnsOf({
  columns,
  roleLabelOf,
}: {
  /** The columns of the dataset the table shows, in the order of its file. */
  columns: ExtractionDatasetColumnDto[]
  roleLabelOf: (column: ExtractionDatasetColumnDto) => string
}): ColumnDef<ExtractionDatasetRecordOutputDto, unknown>[] {
  // Safe: each helper call types its own value, and the list holds them as columns of any value.
  return columns.map((column) =>
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
      cell: (context) => (
        <p className="line-clamp-3 min-w-40 whitespace-pre-wrap wrap-anywhere">
          {context.getValue()}
        </p>
      ),
    }),
  ) as ColumnDef<ExtractionDatasetRecordOutputDto, unknown>[]
}
