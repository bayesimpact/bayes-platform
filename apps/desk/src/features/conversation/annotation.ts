/** The attribute that marks the text of a reply the person can quote. */
export const QUOTABLE_ATTRIBUTE = "data-quotable"

/**
 * The attribute of the element the numbers of annotations are drawn in, around every message: a
 * message clips what overflows it, as a number raised above a first line would.
 */
export const ANNOTATION_LAYER_ATTRIBUTE = "data-annotation-layer"

/**
 * A passage of a reply the person annotated, waiting to be sent with their next message: where it
 * stands, to keep it highlighted, and the element its number is drawn in, which scrolls with it.
 */
export type Annotation = {
  id: string
  passage: string
  note: string
  range: Range
  layer: HTMLElement
}

/**
 * A passage of a reply and the person's note on it, as one line of their message: the passage
 * between backticks, then the note. The passage holds on one line, and its own backticks become
 * quotes, so it cannot close early.
 */
export function annotationLine(passage: string, note: string): string {
  const quoted = passage.replace(/\s+/g, " ").replaceAll("`", "'").trim()
  const trimmedNote = note.trim()
  return trimmedNote === "" ? `\`${quoted}\`` : `\`${quoted}\` ${trimmedNote}`
}

/** The message with one more annotation, on a line of its own after what is written. */
function appendAnnotation(draft: string, line: string): string {
  const written = draft.trimEnd()
  return written === "" ? line : `${written}\n${line}`
}

/**
 * The annotations once this one is saved: in its place, or last when it is new. An annotation
 * whose note is empty is removed, or never added.
 */
export function saveAnnotation<Saved extends { id: string; note: string }>(
  annotations: Saved[],
  annotation: Saved,
): Saved[] {
  if (annotation.note.trim() === "") {
    return annotations.filter((existing) => existing.id !== annotation.id)
  }
  if (!annotations.some((existing) => existing.id === annotation.id)) {
    return [...annotations, annotation]
  }
  return annotations.map((existing) => (existing.id === annotation.id ? annotation : existing))
}

/** The message sent: what the person wrote, then one line per annotation, in their order. */
export function composeMessage(
  draft: string,
  annotations: { passage: string; note: string }[],
): string {
  return annotations.reduce(
    (message, annotation) =>
      appendAnnotation(message, annotationLine(annotation.passage, annotation.note)),
    draft.trim(),
  )
}

/** Whether two ranges start and end at the same places, as one selection read twice does. */
export function isSameRange(first: Range, second: Range): boolean {
  return (
    first.compareBoundaryPoints(Range.START_TO_START, second) === 0 &&
    first.compareBoundaryPoints(Range.END_TO_END, second) === 0
  )
}

/**
 * The passage of a reply the person selected, with where it stands on the screen and the element
 * its number would be drawn in, or `null` when the selection is empty or leaves the reply it
 * starts in.
 */
export function readQuotableSelection(
  selection: Selection | null,
): { text: string; range: Range; layer: HTMLElement } | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null
  const text = selection.toString().trim()
  if (text === "") return null
  const quotableOf = (node: Node | null) =>
    (node instanceof Element ? node : node?.parentElement)?.closest(`[${QUOTABLE_ATTRIBUTE}]`)
  const start = quotableOf(selection.anchorNode)
  if (!(start instanceof HTMLElement) || start !== quotableOf(selection.focusNode)) return null
  const layer = start.closest(`[${ANNOTATION_LAYER_ATTRIBUTE}]`)
  return {
    text,
    range: selection.getRangeAt(0).cloneRange(),
    layer: layer instanceof HTMLElement ? layer : start,
  }
}
