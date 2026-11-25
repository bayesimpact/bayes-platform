import type { ExtractionRunRecordOutputDto } from "@bayes-platform/eval-contracts"
import { cellTextOf } from "@/lib/extraction-columns"

/** A record of the dataset, in the comparison: what names it, and its record in each run. */
export type ExtractionComparisonRow = {
  key: string
  label: string
  byRunId: Record<string, ExtractionRunRecordOutputDto | undefined>
}

/**
 * The rows of the comparison: each record of the dataset one run or more asked, in the order the
 * first run that asked it holds it, named by what the agent read.
 */
export function comparisonRowsOf(
  runs: { runId: string; records: ExtractionRunRecordOutputDto[] }[],
  inputColumnIds: string[],
): ExtractionComparisonRow[] {
  const rows = new Map<string, ExtractionComparisonRow>()
  for (const { runId, records } of runs) {
    for (const record of records) {
      const key = record.evaluationExtractionDatasetRecordId
      const row = rows.get(key) ?? {
        key,
        label: inputColumnIds
          .map((columnId) => cellTextOf(record.datasetRecordData?.[columnId]))
          .filter(Boolean)
          .join(" · "),
        byRunId: {},
      }
      row.byRunId[runId] = record
      rows.set(key, row)
    }
  }
  return [...rows.values()]
}
