import { describe, expect, it } from "vitest"
import {
  defaultKeyMappingOf,
  isKeyMappingComplete,
  matchedFieldsOf,
  outputKeysOf,
} from "./key-mapping"

const version = {
  outputJsonSchema: { type: "object", properties: { Title: {}, summary: {} } },
}
const targets = [
  { id: "column-1", index: 1, originalName: "title", finalName: "title", role: "target" as const },
]

describe("outputKeysOf", () => {
  it("lists the properties of the version's output schema", () => {
    expect(outputKeysOf(version)).toEqual(["Title", "summary"])
  })

  it("is empty for a version with no output schema", () => {
    expect(outputKeysOf({})).toEqual([])
  })
})

describe("defaultKeyMappingOf", () => {
  it("compares a field with the target column of the same name, whatever its case", () => {
    expect(defaultKeyMappingOf(version, targets)).toEqual([
      { agentOutputKey: "Title", datasetColumnId: "column-1", mode: "scored" },
      { agentOutputKey: "summary", datasetColumnId: "", mode: "scored" },
    ])
  })
})

describe("isKeyMappingComplete", () => {
  it("wants a column for each scored field", () => {
    expect(isKeyMappingComplete(defaultKeyMappingOf(version, targets))).toBe(false)
  })

  it("accepts a field that is only shown without a column", () => {
    expect(
      isKeyMappingComplete([
        { agentOutputKey: "Title", datasetColumnId: "column-1", mode: "scored" },
        { agentOutputKey: "summary", datasetColumnId: "", mode: "fyi" },
      ]),
    ).toBe(true)
  })

  it("refuses a mapping with no field", () => {
    expect(isKeyMappingComplete([])).toBe(false)
  })
})

describe("matchedFieldsOf", () => {
  it("counts the scored fields that match, without the fields only shown", () => {
    expect(
      matchedFieldsOf({
        title: { status: "match" },
        category: { status: "mismatch" },
        summary: { status: "fyi" },
      }),
    ).toEqual({ matched: 1, scored: 2 })
  })

  it("is none before a comparison", () => {
    expect(matchedFieldsOf(null)).toBeNull()
  })
})
