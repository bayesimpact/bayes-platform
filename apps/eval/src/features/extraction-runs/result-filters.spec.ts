import { describe, expect, it } from "vitest"
import { resultCountsOf, resultFiltersOf, shownResultFilterOf } from "./result-filters"

const summary = { total: 10, perfectMatches: 4, mismatches: 2, errors: 1, running: 3 }

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
  it("counts the records that wait while the run goes on", () => {
    expect(resultCountsOf({ status: "running", summary })).toEqual({
      all: 10,
      mismatches: 2,
      errors: 1,
      waiting: 3,
      notAsked: 0,
    })
  })

  it("counts them as not asked once the run was cancelled: its figures are not counted again", () => {
    expect(resultCountsOf({ status: "cancelled", summary })).toMatchObject({
      waiting: 0,
      notAsked: 3,
    })
  })

  it("counts nothing before the run started", () => {
    expect(resultCountsOf({ status: "pending", summary: null }).all).toBe(0)
  })
})

describe("shownResultFilterOf", () => {
  it("shows the filter the URL names while the run holds results for it", () => {
    expect(shownResultFilterOf({ status: "running", summary }, "errors")).toBe("errors")
  })

  it("shows every result for a filter that keeps nothing, and without a filter", () => {
    expect(shownResultFilterOf({ status: "running", summary }, "notAsked")).toBe("all")
    expect(shownResultFilterOf({ status: "running", summary }, undefined)).toBe("all")
  })
})
