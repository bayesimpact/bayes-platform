import { describe, expect, it } from "vitest"
import { resultCountsOf, resultFiltersOf } from "./result-filters"

describe("resultFiltersOf", () => {
  it("asks the API the status of the records a filter keeps", () => {
    expect(resultFiltersOf("mismatches")).toEqual({ status: "mismatch" })
    expect(resultFiltersOf("notAsked")).toEqual({ status: "cancelled" })
  })

  it("asks nothing for the filter that keeps every record", () => {
    expect(resultFiltersOf("all")).toEqual({})
  })
})

describe("resultCountsOf", () => {
  it("counts what each filter keeps, from the figures of the run", () => {
    const summary = { total: 10, perfectMatches: 4, mismatches: 2, errors: 1, running: 0 }
    expect(resultCountsOf(summary)).toEqual({
      all: 10,
      mismatches: 2,
      errors: 1,
      waiting: 0,
      // What is left once the others are counted: a cancelled run never asked them.
      notAsked: 3,
    })
  })

  it("counts nothing before the run started", () => {
    expect(resultCountsOf(null).all).toBe(0)
  })
})
