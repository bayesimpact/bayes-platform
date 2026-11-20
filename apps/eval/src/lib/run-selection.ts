/** The runs picked for a comparison, as TanStack Table holds a selection of rows. */
export const rowSelectionOf = (pickedIds: string[]): Record<string, boolean> =>
  Object.fromEntries(pickedIds.map((runId) => [runId, true]))

/**
 * The runs picked once a table changed its selection: those picked before, in their order, then
 * the new ones. The runs of the other tables keep their place: a table only knows its own rows.
 */
export function pickedAfterSelection(
  pickedIds: string[],
  tableRunIds: string[],
  selection: Record<string, boolean>,
): string[] {
  const isPicked = (runId: string) => selection[runId] === true
  const kept = pickedIds.filter((runId) => isPicked(runId) || !tableRunIds.includes(runId))
  const added = tableRunIds.filter((runId) => isPicked(runId) && !pickedIds.includes(runId))
  return [...kept, ...added]
}
