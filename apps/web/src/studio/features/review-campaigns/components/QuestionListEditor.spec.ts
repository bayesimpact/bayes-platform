import { describe, expect, it } from "vitest"
import { parseOptionsText } from "./QuestionListEditor"

describe("parseOptionsText", () => {
  it("parses comma-separated options while ignoring empty entries", () => {
    expect(parseOptionsText("Oui, Partiellement, Non")).toEqual(["Oui", "Partiellement", "Non"])
    expect(parseOptionsText("Oui,")).toEqual(["Oui"])
  })
})
