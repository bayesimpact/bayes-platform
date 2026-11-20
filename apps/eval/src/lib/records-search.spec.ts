import { describe, expect, it } from "vitest"
import { recordsQueryOf } from "./records-search"

describe("recordsQueryOf", () => {
  it("asks the first page in the order of the API, with no filter", () => {
    expect(recordsQueryOf({}, 50)).toEqual({
      page: 0,
      limit: 50,
      columnFilters: undefined,
      sortBy: undefined,
      sortOrder: undefined,
    })
  })

  it("sends the search and the caller's filters as one JSON object", () => {
    const query = recordsQueryOf({ page: 2, searchIn: "column-1", search: "plan" }, 50, {
      status: "error",
    })
    expect(query.page).toBe(2)
    expect(JSON.parse(query.columnFilters ?? "")).toEqual({ status: "error", "column-1": "plan" })
  })

  it("leaves out a search with no text", () => {
    expect(recordsQueryOf({ searchIn: "column-1" }, 50).columnFilters).toBeUndefined()
  })

  it("sorts up unless the search says down", () => {
    expect(recordsQueryOf({ sortBy: "column-1" }, 50).sortOrder).toBe("asc")
    expect(recordsQueryOf({ sortBy: "column-1", sortOrder: "desc" }, 50).sortOrder).toBe("desc")
  })
})
