import { describe, expect, it } from "vitest"
import { scoredFieldStatuses } from "./evaluation-extraction-runs.helpers"

describe("scoredFieldStatuses", () => {
  it("names each scored field with its status, in the order of the comparison", () => {
    expect(
      scoredFieldStatuses({
        title: { status: "match" },
        summary: { status: "mismatch" },
      }),
    ).toEqual([
      { fieldKey: "title", status: "match" },
      { fieldKey: "summary", status: "mismatch" },
    ])
  })

  it("leaves out the fields that are not scored", () => {
    expect(
      scoredFieldStatuses({
        title: { status: "match" },
        notes: { status: "fyi" },
        summary: { status: "mismatch" },
      }).map((field) => field.fieldKey),
    ).toEqual(["title", "summary"])
  })

  it("is empty with one scored field, since the record status already says it", () => {
    expect(
      scoredFieldStatuses({
        title: { status: "mismatch" },
        notes: { status: "fyi" },
      }),
    ).toEqual([])
  })

  it("is empty without any field", () => {
    expect(scoredFieldStatuses({})).toEqual([])
  })
})
