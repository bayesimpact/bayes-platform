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
 * match on: it takes the row of the same place in its run.
 */
export function comparisonRowsOf(
  runs: { runId: string; records: ConversationRunRecordOutputDto[] }[],
): ConversationComparisonRow[] {
  const rows = new Map<string, ConversationComparisonRow>()
  for (const { runId, records } of runs) {
    records.forEach((record, index) => {
      const key = record.evaluationConversationDatasetRecordId ?? `#${index}`
      const row = rows.get(key) ?? {
        key,
        input: record.input,
        expectedOutput: record.expectedOutput,
        byRunId: {},
      }
      row.byRunId[runId] = record
      rows.set(key, row)
    })
  }
  return [...rows.values()]
}
