/** The name of the highlight global.css styles as the browser's selection. */
const QUOTE_HIGHLIGHT = "desk-quote"

/**
 * Keeps a quoted passage highlighted once the person's selection goes, as it does when they move
 * to the note: with the CSS Custom Highlight API, where the browser has it, and nothing otherwise.
 */
export function showQuoteHighlight(range: Range): void {
  if (typeof CSS === "undefined" || !("highlights" in CSS)) return
  CSS.highlights.set(QUOTE_HIGHLIGHT, new Highlight(range))
}

export function clearQuoteHighlight(): void {
  if (typeof CSS === "undefined" || !("highlights" in CSS)) return
  CSS.highlights.delete(QUOTE_HIGHLIGHT)
}
