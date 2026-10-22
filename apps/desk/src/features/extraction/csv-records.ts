import type { CsvColumnDto } from "@caseai-connect/desk-contracts"
import { hasOwnKey } from "@/lib/has-own-key"

/** The columns of the file a run's results show beside the answers: the read and kept ones. */
export function shownFileColumnsOf(columnSchema: Record<string, CsvColumnDto>): CsvColumnDto[] {
  return Object.values(columnSchema)
    .filter((column) => column.role !== "ignore")
    .sort((first, second) => first.index - second.index)
}

/** The key the API sorts the rows by, for a column of the results. */
export const sortKeys = {
  row: "rowIndex",
  status: "status",
  answer: (field: string) => `agent_${field}`,
  fileColumn: (columnId: string) => `input_${columnId}`,
}

/** A row's value in a column of the file, as one line of text. */
export function fileValueOf(inputData: Record<string, unknown> | null, columnId: string): string {
  const value = inputData && hasOwnKey(inputData, columnId) ? inputData[columnId] : undefined
  if (value === null || value === undefined) return ""
  return typeof value === "string" ? value : JSON.stringify(value)
}
