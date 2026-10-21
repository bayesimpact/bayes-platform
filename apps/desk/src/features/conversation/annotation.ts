/** The attribute that marks the text of a reply the person can quote. */
export const QUOTABLE_ATTRIBUTE = "data-quotable"

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
export function appendAnnotation(draft: string, line: string): string {
  const written = draft.trimEnd()
  return written === "" ? line : `${written}\n${line}`
}

/**
 * The passage of a reply the person selected, with where it stands on the screen, or `null` when
 * the selection is empty or leaves the reply it starts in.
 */
export function readQuotableSelection(
  selection: Selection | null,
): { text: string; range: Range } | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null
  const text = selection.toString().trim()
  if (text === "") return null
  const quotableOf = (node: Node | null) =>
    (node instanceof Element ? node : node?.parentElement)?.closest(`[${QUOTABLE_ATTRIBUTE}]`)
  const start = quotableOf(selection.anchorNode)
  if (!start || start !== quotableOf(selection.focusNode)) return null
  return { text, range: selection.getRangeAt(0).cloneRange() }
}
