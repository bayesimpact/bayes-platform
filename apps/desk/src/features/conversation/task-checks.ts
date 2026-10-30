/**
 * The tasks of a reply the person ticked or unticked, which leave with their next message, as the
 * annotations do: one line per task, naming the reply, the task's place in it from 1 and its
 * text, so the agent reads what is done. The conversation hides these lines, and reads them back
 * to show each task as it was last left.
 */

/** A tick of a task, as the next message sends it. */
export type TaskCheck = { replyId: string; item: number; isChecked: boolean; text: string }

/** A line that ticks or unticks a task, alone on its line. */
const TASK_CHECK_PATTERN =
  /^<(checked|unchecked) reply="([^"\n]+)" item="(\d+)">([^\n]*)<\/(?:checked|unchecked)>$/

/** The line a tick leaves as, its text on one line, which no closing tag in it can end early. */
export function taskCheckLine({ replyId, item, isChecked, text }: TaskCheck): string {
  const tag = isChecked ? "checked" : "unchecked"
  const oneLine = text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/<\/(un)?checked>/g, "</ $1checked>")
  return `<${tag} reply="${replyId}" item="${item}">${oneLine}</${tag}>`
}

/** A message without its lines that tick tasks. */
export function withoutTaskChecks(content: string): string {
  return content
    .split("\n")
    .filter((line) => !TASK_CHECK_PATTERN.test(line))
    .join("\n")
}

/** The ticks a message sent, in their order. */
export function taskChecksOf(content: string): TaskCheck[] {
  return content.split("\n").flatMap((line): TaskCheck[] => {
    const match = TASK_CHECK_PATTERN.exec(line)
    if (!match) return []
    const [, tag, replyId = "", item, text = ""] = match
    return [{ replyId, item: Number(item), isChecked: tag === "checked", text }]
  })
}

/**
 * The state each task was last given by the person's messages, by reply, then by the task's
 * place. A reply's own lines never tick anything.
 */
export function savedTaskStatesOf(
  messages: { role: string; content: string }[],
): Map<string, Map<number, boolean>> {
  const states = new Map<string, Map<number, boolean>>()
  for (const message of messages) {
    if (message.role !== "user") continue
    for (const { replyId, item, isChecked } of taskChecksOf(message.content)) {
      const replyStates = states.get(replyId) ?? new Map<number, boolean>()
      replyStates.set(item, isChecked)
      states.set(replyId, replyStates)
    }
  }
  return states
}
