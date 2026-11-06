import { ToolName } from "@caseai-connect/api-contracts"
import { describe, expect, it } from "vitest"
import { findFollowUpQuestions, followUpReplyIndex } from "./follow-up-questions"

describe("findFollowUpQuestions", () => {
  it("returns no question without the tool", () => {
    expect(findFollowUpQuestions(undefined)).toEqual([])
    expect(findFollowUpQuestions([{ name: ToolName.SurfaceResources, arguments: {} }])).toEqual([])
  })

  it("reads the questions of the last call and drops invalid entries", () => {
    expect(
      findFollowUpQuestions([
        { name: ToolName.SuggestFollowUpQuestions, arguments: { questions: ["Old?"] } },
        {
          name: ToolName.SuggestFollowUpQuestions,
          arguments: { questions: ["First?", "", 3, "Second?"] },
        },
      ]),
    ).toEqual(["First?", "Second?"])
  })
})

describe("followUpReplyIndex", () => {
  it("points at a finished last reply", () => {
    expect(followUpReplyIndex([{ role: "user" }, { role: "assistant", status: "completed" }])).toBe(
      1,
    )
  })

  it("skips the tool rows stored after the reply, as a reloaded session lists them", () => {
    expect(
      followUpReplyIndex([
        { role: "user" },
        { role: "assistant", status: "completed" },
        { role: "tool" },
        { role: "tool" },
      ]),
    ).toBe(1)
  })

  it("is undefined while the reply streams or after a new user message", () => {
    expect(
      followUpReplyIndex([{ role: "user" }, { role: "assistant", status: "streaming" }]),
    ).toBeUndefined()
    expect(
      followUpReplyIndex([{ role: "assistant", status: "completed" }, { role: "user" }]),
    ).toBeUndefined()
    expect(followUpReplyIndex([])).toBeUndefined()
  })
})
