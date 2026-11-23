import { describe, expect, it } from "vitest"
import { pickedAfterSelection, rowSelectionOf } from "./run-selection"

describe("rowSelectionOf", () => {
  it("marks each picked run as a selected row", () => {
    expect(rowSelectionOf(["a", "b"])).toEqual({ a: true, b: true })
  })
})

describe("pickedAfterSelection", () => {
  it("adds a run the table selects after those picked before", () => {
    expect(pickedAfterSelection(["a"], ["a", "b"], { a: true, b: true })).toEqual(["a", "b"])
  })

  it("drops a run the table no longer selects", () => {
    expect(pickedAfterSelection(["a", "b"], ["a", "b"], { b: true })).toEqual(["b"])
  })

  it("keeps the runs picked in another table", () => {
    expect(pickedAfterSelection(["other", "a"], ["a", "b"], { b: true })).toEqual(["other", "b"])
  })
})
