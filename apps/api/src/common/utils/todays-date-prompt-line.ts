/**
 * Formats a date as YYYY-MM-DD from the local calendar fields — not
 * `toISOString()`, which reports the UTC day and is already tomorrow late in
 * the evening east of Greenwich, and not `toLocaleDateString()`, whose output
 * depends on the host locale.
 */
function formatPromptDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * The single line every system prompt uses to state the current date. The
 * format is spelled out alongside the value because a bare 2026-09-02 is
 * still ambiguous to a model that has seen day-first dates: it can read the
 * segments in the wrong order and answer relative-date questions off by
 * months.
 */
export function todaysDatePromptLine(date: Date = new Date()): string {
  return `Today's date: ${formatPromptDate(date)} (Date format YYYY-MM-DD)`
}
