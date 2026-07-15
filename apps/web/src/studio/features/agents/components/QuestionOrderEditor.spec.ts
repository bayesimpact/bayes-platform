import { describe, expect, it } from "vitest"
import { reorderKeys } from "./QuestionOrderEditor"

describe("reorderKeys", () => {
  it("moves an item forward to the target position", () => {
    expect(reorderKeys(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"])
  })

  it("moves an item backward to the target position", () => {
    expect(reorderKeys(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"])
  })

  it("moves the last item into first position", () => {
    expect(reorderKeys(["a", "b", "c", "d"], "d", "a")).toEqual(["d", "a", "b", "c"])
  })

  it("leaves the list unchanged when active and over keys are identical", () => {
    expect(reorderKeys(["a", "b", "c"], "b", "b")).toEqual(["a", "b", "c"])
  })

  it("leaves the list unchanged when a key is missing", () => {
    expect(reorderKeys(["a", "b", "c"], "x", "a")).toEqual(["a", "b", "c"])
  })
})
