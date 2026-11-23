import { describe, expect, it } from "vitest"
import { matchRateOf, percentOf } from "./match-rate"

const summary = { total: 8, perfectMatches: 6, mismatches: 1, errors: 1, running: 0 }

describe("matchRateOf", () => {
  it("is the share of the records that match on every scored field", () => {
    expect(matchRateOf(summary)).toBe(0.75)
  })

  it("is none before the run asked a record", () => {
    expect(matchRateOf(null)).toBeNull()
    expect(matchRateOf({ ...summary, total: 0, perfectMatches: 0 })).toBeNull()
  })
})

describe("percentOf", () => {
  it("is a whole percentage", () => {
    expect(percentOf(0.756, "en")).toBe("76%")
  })
})
