/**
 * The highlights global.css styles: the passages being annotated, as the browser's selection, the
 * paler passages the messages quoted, and the one a person just jumped to.
 */
const QUOTE_HIGHLIGHT = "desk-quote"
export const CITED_HIGHLIGHT = "desk-cited"
export const JUMPED_HIGHLIGHT = "desk-cited-jump"

type HighlightName = typeof QUOTE_HIGHLIGHT | typeof CITED_HIGHLIGHT | typeof JUMPED_HIGHLIGHT

const hasHighlights = () => typeof CSS !== "undefined" && "highlights" in CSS

/**
 * Highlights passages with the CSS Custom Highlight API, where the browser has it, and nothing
 * otherwise: by default the ones being annotated, kept once the person's selection goes, as it
 * does when they move to their note.
 */
export function showQuoteHighlights(ranges: Range[], name: HighlightName = QUOTE_HIGHLIGHT): void {
  if (!hasHighlights()) return
  if (ranges.length === 0) {
    CSS.highlights.delete(name)
    return
  }
  CSS.highlights.set(name, new Highlight(...ranges))
}

export function clearQuoteHighlights(name: HighlightName = QUOTE_HIGHLIGHT): void {
  if (hasHighlights()) CSS.highlights.delete(name)
}

/**
 * The text of a reply as a passage is searched in it: its characters without the spaces, each
 * with the place it stands. Selecting across blocks adds line breaks the page's text lacks, and a
 * quoted passage holds on one line, so spaces do not count.
 */
export type PassageIndex = {
  text: string
  places: { node: Text; offset: number }[]
}

export function indexPassages(root: Node): PassageIndex {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const index: PassageIndex = { text: "", places: [] }
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (!(node instanceof Text)) continue
    for (let offset = 0; offset < node.data.length; offset++) {
      const character = node.data[offset] ?? ""
      if (/\s/.test(character)) continue
      index.text += character
      index.places.push({ node, offset })
    }
  }
  return index
}

/** Where each occurrence of a passage's text starts in a reply's text, in order. */
function occurrenceStartsOf(index: PassageIndex, passage: string): number[] {
  const wanted = passage.replace(/\s+/g, "")
  const starts: number[] = []
  if (wanted === "") return starts
  for (
    let start = index.text.indexOf(wanted);
    start !== -1;
    start = index.text.indexOf(wanted, start + 1)
  ) {
    starts.push(start)
  }
  return starts
}

/**
 * Which occurrence of a passage's text, from 1, a selection of the reply holds: the first that
 * starts inside it. Counting every occurrence, inside longer words too, finds the same one again
 * later, however many stand before it.
 */
export function occurrenceAt(index: PassageIndex, passage: string, selection: Range): number {
  const position = occurrenceStartsOf(index, passage).findIndex((start) => {
    const place = index.places[start]
    return place !== undefined && selection.comparePoint(place.node, place.offset) >= 0
  })
  return position === -1 ? 1 : position + 1
}

/** Where an occurrence of a quoted passage stands in a reply, or `null` when it is not there. */
export function findPassage(index: PassageIndex, passage: string, occurrence = 1): Range | null {
  const wantedLength = passage.replace(/\s+/g, "").length
  const start = occurrenceStartsOf(index, passage)[occurrence - 1]
  const first = start === undefined ? undefined : index.places[start]
  const last = start === undefined ? undefined : index.places[start + wantedLength - 1]
  if (!first || !last) return null
  const range = document.createRange()
  range.setStart(first.node, first.offset)
  range.setEnd(last.node, last.offset + 1)
  return range
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
