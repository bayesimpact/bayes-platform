import { describe, expect, it } from "vitest"
import { parseOptionsText } from "./QuestionListEditor"

describe("parseOptionsText", () => {
  it("parses comma-separated options while ignoring empty entries", () => {
    expect(parseOptionsText("Yes, Partially, No")).toEqual(["Yes", "Partially", "No"])
    expect(parseOptionsText("Yes,")).toEqual(["Yes"])
  })
})
