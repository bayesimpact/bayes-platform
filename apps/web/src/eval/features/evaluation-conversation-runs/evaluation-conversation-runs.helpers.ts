// Last 6 chars of the run id (e.g. "894f5f5b-...-a3b4b3837502" -> "837502"): a short,
// human-readable handle to tell runs apart when their agent/version/model match.
// 6 hex chars keep collisions negligible for the handful of runs a dataset has.
export function shortRunId(runId: string): string {
  return runId.slice(-6)
}
