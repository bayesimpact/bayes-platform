import { describe, expect, it } from "vitest"
import { savedTaskStatesOf, taskCheckLine, taskChecksOf, withoutTaskChecks } from "./task-checks"

describe("taskCheckLine", () => {
  it("names the reply, the task's place and its text, on one line", () => {
    const replyId = crypto.randomUUID()
    expect(taskCheckLine({ replyId, item: 2, isChecked: true, text: " Freeze\n the scope " })).toBe(
      `<checked reply="${replyId}" item="2">Freeze the scope</checked>`,
    )
    expect(taskCheckLine({ replyId, item: 1, isChecked: false, text: "Set the price" })).toBe(
      `<unchecked reply="${replyId}" item="1">Set the price</unchecked>`,
    )
  })
})

describe("withoutTaskChecks", () => {
  it("drops the lines that tick tasks, which the conversation does not show", () => {
    const replyId = crypto.randomUUID()
    const content = [
      "Thanks!",
      taskCheckLine({ replyId, item: 1, isChecked: true, text: "Freeze the scope" }),
      "<quote>plan</quote> which one?",
    ].join("\n")
    expect(withoutTaskChecks(content)).toBe("Thanks!\n<quote>plan</quote> which one?")
  })
})

describe("savedTaskStatesOf", () => {
  it("keeps the last state each task was given, by reply and by place", () => {
    const replyId = crypto.randomUUID()
    const sent = (content: string) => ({ role: "user", content })
    const states = savedTaskStatesOf([
      sent(taskCheckLine({ replyId, item: 1, isChecked: true, text: "a" })),
      { role: "assistant", content: `<checked reply="${replyId}" item="2">b</checked>` },
      sent(
        [
          taskCheckLine({ replyId, item: 1, isChecked: false, text: "a" }),
          taskCheckLine({ replyId, item: 3, isChecked: true, text: "c" }),
        ].join("\n"),
      ),
    ])
    expect(states.get(replyId)).toEqual(
      new Map([
        [1, false],
        [3, true],
      ]),
    )
  })
})

describe("taskChecksOf", () => {
  it("reads the ticks a message sent, in order, with their state and their text", () => {
    const replyId = crypto.randomUUID()
    const content = [
      "Done",
      taskCheckLine({ replyId, item: 2, isChecked: true, text: "Bananas" }),
      taskCheckLine({ replyId, item: 1, isChecked: false, text: "Apples" }),
    ].join("\n")
    expect(taskChecksOf(content)).toEqual([
      { replyId, item: 2, isChecked: true, text: "Bananas" },
      { replyId, item: 1, isChecked: false, text: "Apples" },
    ])
  })
})
