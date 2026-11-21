import type { ConversationRunRecordOutputDto } from "@caseai-connect/eval-contracts"

/** A record of the dataset, in the comparison: what it asks, and its record in each run. */
export type ConversationComparisonRow = {
  key: string
  input: string
  expectedOutput: string
  byRunId: Record<string, ConversationRunRecordOutputDto | undefined>
}

/**
 * The rows of the comparison: each record of the dataset one run or more asked, in the order the
 * first run that asked it holds it. A run's record whose dataset record was deleted has no id to
 * match on: it keeps the input and the expected output it asked, and matches the record of
 * another run that asked the same, so two runs that asked other records keep them apart.
 */
export function comparisonRowsOf(
  runs: { runId: string; records: ConversationRunRecordOutputDto[] }[],
): ConversationComparisonRow[] {
  const rows = new Map<string, ConversationComparisonRow>()
  for (const { runId, records } of runs) {
    // How many times the run asked each text whose record was deleted: a text asked twice in a
    // run takes two rows, which match the first and the second time another run asked it.
    const deletedAsked = new Map<string, number>()
    for (const record of records) {
      const key = record.evaluationConversationDatasetRecordId ?? deletedKeyOf(record, deletedAsked)
      const row = rows.get(key) ?? {
        key,
        input: record.input,
        expectedOutput: record.expectedOutput,
        byRunId: {},
      }
      row.byRunId[runId] = record
      rows.set(key, row)
    }
  }
  return [...rows.values()]
}

/** The key of a record whose dataset record was deleted: what it asked, and which time in its run. */
function deletedKeyOf(
  record: Pick<ConversationRunRecordOutputDto, "input" | "expectedOutput">,
  deletedAsked: Map<string, number>,
): string {
  const asked = JSON.stringify([record.input, record.expectedOutput])
  const occurrence = deletedAsked.get(asked) ?? 0
  deletedAsked.set(asked, occurrence + 1)
  return `deleted:${occurrence}:${asked}`
}
