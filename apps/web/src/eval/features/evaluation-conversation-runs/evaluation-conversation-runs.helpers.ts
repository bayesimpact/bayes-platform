// Last UUID segment (e.g. "894f5f5b-...-a3b4b3837502" -> "a3b4b3837502"): a short,
// human-readable handle to tell runs apart when their agent/version/model match.
export function shortRunId(runId: string): string {
  return runId.split("-").pop() ?? runId
}
