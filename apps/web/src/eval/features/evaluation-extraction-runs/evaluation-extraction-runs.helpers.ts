import type { EvaluationExtractionRunRecordFieldStatus } from "./evaluation-extraction-runs.models"

// Last 6 chars of the run id (e.g. "894f5f5b-...-a3b4b3837502" -> "837502"): a short,
// human-readable handle to tell runs apart when their agent/version match.
// 6 hex chars keep collisions negligible for the handful of runs a dataset has.
export function shortRunId(runId: string): string {
  return runId.slice(-6)
}

export type ScoredFieldStatus = {
  fieldKey: string
  status: Exclude<EvaluationExtractionRunRecordFieldStatus, "fyi">
}

// The per-field statuses a record shows next to its overall status. "fyi" fields are not scored.
// With one scored field or none, the overall status already says everything: the list is empty.
export function scoredFieldStatuses(
  fields: Record<string, { status: EvaluationExtractionRunRecordFieldStatus }>,
): ScoredFieldStatus[] {
  const scoredFields = Object.entries(fields).flatMap(([fieldKey, field]) =>
    field.status === "fyi" ? [] : [{ fieldKey, status: field.status }],
  )
  return scoredFields.length > 1 ? scoredFields : []
}
