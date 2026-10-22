import type { CsvColumnDto, CsvExtractionRecordOutputDto } from "@caseai-connect/desk-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table"
import { fieldLabelOf } from "@/lib/field-text"
import { fileValueOf, sortKeys } from "../csv-records"
import { FieldValue } from "./FieldValue"
import { RecordStatusIcon } from "./RecordStatusIcon"

const columnHelper = createColumnHelper<CsvExtractionRecordOutputDto>()

/** The texts of the headers, which the table translates. */
const recordColumnLabels = {
  row: msg({ message: "Row", comment: "The number of a row of a CSV file" }),
  status: msg({ message: "Status", comment: "Where a row of a CSV run stands" }),
  answers: msg`Agent's answers`,
  file: msg`From the file`,
  failed: msg`The agent could not answer for this row.`,
} satisfies Record<string, MessageDescriptor>

/**
 * The columns of a CSV run's results: the row's number and status, the fields the agent filled
 * in, then the file's columns it read or kept. Each sorts on the API.
 */
export function recordColumnsOf({
  answerFields,
  fileColumns,
  translate,
  openLabel,
}: {
  answerFields: string[]
  fileColumns: CsvColumnDto[]
  translate: (descriptor: MessageDescriptor) => string
  /** The name of the button that opens a row, by its number. */
  openLabel: (rowNumber: number) => string
}): ColumnDef<CsvExtractionRecordOutputDto, unknown>[] {
  const columns: ColumnDef<CsvExtractionRecordOutputDto, unknown>[] = [
    columnHelper.accessor((record) => record.rowIndex + 1, {
      id: sortKeys.row,
      header: translate(recordColumnLabels.row),
      // The number opens the row from the keyboard; a click anywhere on the row opens it too.
      cell: (context) => (
        <button
          type="button"
          aria-label={openLabel(context.getValue())}
          className="rounded-sm text-muted-foreground tabular-nums underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {context.getValue()}
        </button>
      ),
      meta: { headerClassName: "w-14", cellClassName: "w-14" },
    }),
    columnHelper.accessor("status", {
      id: sortKeys.status,
      header: translate(recordColumnLabels.status),
      cell: (context) => <RecordStatusIcon record={context.row.original} />,
      meta: { headerClassName: "w-16", cellClassName: "w-16" },
    }),
  ]
  if (answerFields.length > 0) {
    columns.push(
      columnHelper.group({
        id: "answers",
        header: translate(recordColumnLabels.answers),
        columns: answerFields.map((field, position) =>
          columnHelper.accessor((record) => record.agentRawOutput?.[field], {
            id: sortKeys.answer(field),
            header: fieldLabelOf(field),
            cell: (context) => {
              const record = context.row.original
              if (record.agentRawOutput) return <FieldValue value={context.getValue()} isCompact />
              // A failed row says why under its first answer.
              return position === 0 && record.status === "error" ? (
                <span className="line-clamp-2 text-destructive">
                  {record.errorDetails ?? translate(recordColumnLabels.failed)}
                </span>
              ) : null
            },
            meta: { cellClassName: "min-w-48 max-w-80 whitespace-normal" },
          }),
        ),
      }),
    )
  }
  if (fileColumns.length > 0) {
    columns.push(
      columnHelper.group({
        id: "file",
        header: translate(recordColumnLabels.file),
        meta: { headerClassName: "text-muted-foreground" },
        columns: fileColumns.map((column) =>
          columnHelper.accessor((record) => fileValueOf(record.inputData, column.id), {
            id: sortKeys.fileColumn(column.id),
            header: column.finalName,
            cell: (context) => (
              <span className="line-clamp-2 break-words text-muted-foreground">
                {context.getValue()}
              </span>
            ),
            meta: {
              headerClassName: "text-muted-foreground",
              cellClassName: "min-w-32 max-w-64 whitespace-normal",
            },
          }),
        ),
      }),
    )
  }
  return columns
}
