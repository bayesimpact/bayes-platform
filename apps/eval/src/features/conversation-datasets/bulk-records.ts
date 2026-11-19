import {
  CONVERSATION_DATASET_RECORD_MAX_LENGTH,
  type ConversationDatasetRecordInputDto,
} from "@caseai-connect/eval-contracts"

/** What pasted lines hold: the records to add, and the lines that make none, by their number. */
export type ParsedBulkRecords = {
  records: ConversationDatasetRecordInputDto[]
  /** Lines with no comma, or nothing on one of its sides. */
  invalidLines: number[]
  /** Lines whose input or expected output is longer than a record takes. */
  tooLongLines: number[]
}

/**
 * Reads pasted lines as records, one per line: the input, a comma, then the expected output, which
 * may hold commas of its own. Empty lines are skipped; lines count from 1.
 */
export function parseBulkRecords(text: string): ParsedBulkRecords {
  const parsed: ParsedBulkRecords = { records: [], invalidLines: [], tooLongLines: [] }
  text.split("\n").forEach((line, index) => {
    if (line.trim() === "") return
    const lineNumber = index + 1
    const commaAt = line.indexOf(",")
    const input = commaAt === -1 ? "" : line.slice(0, commaAt).trim()
    const expectedOutput = commaAt === -1 ? "" : line.slice(commaAt + 1).trim()
    if (input === "" || expectedOutput === "") {
      parsed.invalidLines.push(lineNumber)
    } else if (
      input.length > CONVERSATION_DATASET_RECORD_MAX_LENGTH ||
      expectedOutput.length > CONVERSATION_DATASET_RECORD_MAX_LENGTH
    ) {
      parsed.tooLongLines.push(lineNumber)
    } else {
      parsed.records.push({ input, expectedOutput })
    }
  })
  return parsed
}
