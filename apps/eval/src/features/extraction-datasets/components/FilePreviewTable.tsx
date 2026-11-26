import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@caseai-connect/app-ui/components/table"
import type { ExtractionDatasetFileColumnOutputDto } from "@caseai-connect/eval-contracts"

export type FilePreviewTableProps = {
  /** The columns of a file, each with its first values. */
  columns: ExtractionDatasetFileColumnOutputDto[]
}

/** The first rows of a CSV file, as the file holds them, to tell what each column is. */
export function FilePreviewTable({ columns }: FilePreviewTableProps) {
  const rowCount = Math.max(0, ...columns.map((column) => column.values.length))
  const rowIndexes = Array.from({ length: rowCount }, (_, rowIndex) => rowIndex)
  return (
    <div className="max-h-64 overflow-auto rounded-lg border">
      <Table>
        <TableHeader className="sticky top-0 bg-muted">
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead key={column.id} className="h-9 text-xs">
                {column.name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rowIndexes.map((rowIndex) => (
            <TableRow key={rowIndex}>
              {columns.map((column) => (
                <TableCell key={column.id} className="max-w-64 truncate text-muted-foreground">
                  {column.values[rowIndex] ?? ""}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
