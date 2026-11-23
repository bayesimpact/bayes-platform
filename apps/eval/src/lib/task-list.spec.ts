import { describe, expect, it } from "vitest"
import { taskListOf, withTaskStates } from "./task-list"

const REPLY = [
  "What to check:",
  "",
  "- [ ] The tool accepts `team`",
  "- [x] A change credits the old plan",
  "",
  "```md",
  "- [ ] not a task, inside code",
  "```",
  "",
  "1. [X] Numbered and done",
].join("\n")

describe("taskListOf", () => {
  it("lists the tasks of a reply in order, with their state, and leaves out those in code", () => {
    expect(taskListOf(REPLY)).toEqual([false, true, true])
  })
})

describe("withTaskStates", () => {
  it("ticks or unticks the tasks of a reply by their place, from 1, and leaves code alone", () => {
    const changed = withTaskStates(
      REPLY,
      new Map([
        [1, true],
        [3, false],
      ]),
    )
    expect(taskListOf(changed)).toEqual([true, true, false])
    expect(changed).toContain("- [ ] not a task, inside code")
  })
})
