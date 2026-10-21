/** The name of the highlight global.css styles as the browser's selection. */
const QUOTE_HIGHLIGHT = "desk-quote"

const hasHighlights = () => typeof CSS !== "undefined" && "highlights" in CSS

/**
 * Keeps quoted passages highlighted once the person's selection goes, as it does when they move
 * to their note: with the CSS Custom Highlight API, where the browser has it, and nothing otherwise.
 */
export function showQuoteHighlights(ranges: Range[]): void {
  if (!hasHighlights()) return
  if (ranges.length === 0) {
    CSS.highlights.delete(QUOTE_HIGHLIGHT)
    return
  }
  CSS.highlights.set(QUOTE_HIGHLIGHT, new Highlight(...ranges))
}

export function clearQuoteHighlights(): void {
  if (hasHighlights()) CSS.highlights.delete(QUOTE_HIGHLIGHT)
}

/** Whether a point of the screen, such as a click, falls on the text of a range. */
export function isPointInRange(range: Range, x: number, y: number): boolean {
  return Array.from(range.getClientRects()).some(
    (rect) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom,
  )
}

/** Where a range's text ends on its last line, in pixels from the top left of `container`. */
export function measureRangeEnd(
  range: Range,
  container: Element,
): { left: number; top: number } | null {
  const lines = Array.from(range.getClientRects()).filter((rect) => rect.width > 0)
  const last = lines.at(-1)
  if (!last) return null
  const origin = container.getBoundingClientRect()
  return { left: last.right - origin.left, top: last.top - origin.top }
}
