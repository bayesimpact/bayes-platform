/**
 * The tasks of a Markdown text: the items of its lists that open with `[ ]` or `[x]`, outside its
 * fenced code. A task is named by its place among them, from 1, which is also its place among the
 * checkboxes the text renders.
 */

/** A task's line: its list marker and the opening bracket, its state, then the rest of the line. */
const TASK_PATTERN = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\].*)$/

/** A line that opens or closes fenced code. */
const FENCE_PATTERN = /^\s*(```|~~~)/

/** Calls `onTask` with each task line's index in `lines` and its match, in order. */
function forEachTask(lines: string[], onTask: (lineIndex: number, match: RegExpExecArray) => void) {
  let isInCode = false
  for (const [lineIndex, line] of lines.entries()) {
    if (FENCE_PATTERN.test(line)) {
      isInCode = !isInCode
      continue
    }
    const match = isInCode ? null : TASK_PATTERN.exec(line)
    if (match) onTask(lineIndex, match)
  }
}

/** Whether each task of the text is checked, in order. */
export function taskListOf(markdown: string): boolean[] {
  const states: boolean[] = []
  forEachTask(markdown.split("\n"), (_lineIndex, match) => states.push(match[2] !== " "))
  return states
}

/** The text with some of its tasks ticked or unticked, by their place from 1. */
export function withTaskStates(markdown: string, states: ReadonlyMap<number, boolean>): string {
  if (states.size === 0) return markdown
  const lines = markdown.split("\n")
  let item = 0
  forEachTask(lines, (lineIndex, match) => {
    item += 1
    const isChecked = states.get(item)
    if (isChecked === undefined) return
    lines[lineIndex] = `${match[1]}${isChecked ? "x" : " "}${match[3]}`
  })
  return lines.join("\n")
}
