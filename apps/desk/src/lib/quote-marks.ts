/** Where a highlighter stroke stands, in pixels from the top left of the element it is drawn in. */
export type QuoteMark = { left: number; top: number; width: number; height: number }

/** How far a stroke runs past the words on each side, as a highlighter does. */
const OVERHANG = 2

/**
 * The strokes that highlight a passage, one per line it covers, placed in `container`. Only the text
 * is measured: the boxes of the elements the passage spans would cover whole paragraphs.
 */
export function measureQuoteMarks(range: Range, container: Element): QuoteMark[] {
  const origin = container.getBoundingClientRect()
  const lines: DOMRect[] = []
  for (const textNode of textNodesOf(range)) {
    const part = document.createRange()
    part.selectNodeContents(textNode)
    if (textNode === range.startContainer) part.setStart(textNode, range.startOffset)
    if (textNode === range.endContainer) part.setEnd(textNode, range.endOffset)
    for (const rect of part.getClientRects()) {
      if (rect.width > 0) lines.push(rect)
    }
  }
  return joinLines(lines).map((line) => ({
    left: line.left - origin.left - OVERHANG,
    top: line.top - origin.top,
    width: line.right - line.left + 2 * OVERHANG,
    height: line.bottom - line.top,
  }))
}

function textNodesOf(range: Range): Text[] {
  const root = range.commonAncestorContainer
  if (root instanceof Text) return [root]
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof Text && range.intersectsNode(node)) textNodes.push(node)
  }
  return textNodes
}

type Line = { left: number; right: number; top: number; bottom: number }

/** Pieces of text side by side on one line, such as a word in bold, make one stroke. */
function joinLines(rects: DOMRect[]): Line[] {
  const lines: Line[] = []
  for (const rect of rects) {
    const middle = (rect.top + rect.bottom) / 2
    const line = lines.find(
      (candidate) =>
        middle > candidate.top &&
        middle < candidate.bottom &&
        rect.left <= candidate.right + 1 &&
        rect.right >= candidate.left - 1,
    )
    if (line) {
      line.left = Math.min(line.left, rect.left)
      line.right = Math.max(line.right, rect.right)
      line.top = Math.min(line.top, rect.top)
      line.bottom = Math.max(line.bottom, rect.bottom)
    } else {
      lines.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom })
    }
  }
  return lines
}
