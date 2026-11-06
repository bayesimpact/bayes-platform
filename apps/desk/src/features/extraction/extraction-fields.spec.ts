import { describe, expect, it } from "vitest"
import { extractedFieldsOf, fieldKeysOf, isEmptyValue, resultFileNameOf } from "./extraction-fields"

describe("extractedFieldsOf", () => {
  it("keeps the agent's order", () => {
    expect(
      extractedFieldsOf({ title: "Report", pageCount: 3 }).map((field) => field.label),
    ).toEqual(["Title", "Page count"])
  })
})

describe("fieldKeysOf", () => {
  it("lists the keys of every result once, in the order they first appear", () => {
    expect(fieldKeysOf([{ title: "A" }, null, { title: "B", topic: "C" }])).toEqual([
      "title",
      "topic",
    ])
  })
})

describe("isEmptyValue", () => {
  it("tells an empty value from one the agent found", () => {
    expect([null, undefined, "  ", []].every(isEmptyValue)).toBe(true)
    expect([0, false, "a"].some(isEmptyValue)).toBe(false)
  })
})

describe("resultFileNameOf", () => {
  it("names the JSON file after the document", () => {
    expect(resultFileNameOf("report.pdf")).toBe("report.json")
    expect(resultFileNameOf(null)).toBe("extraction.json")
  })
})
