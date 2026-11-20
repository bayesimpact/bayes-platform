import { describe, expect, it } from "vitest"
import { hasFilters, recordsQueryOf, searchWithFilter } from "./records-search"

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

  it("sends the filters of the search and the caller's as one JSON object", () => {
    const query = recordsQueryOf({ page: 2, filters: { "column-1": "plan" } }, 50, {
      status: "error",
    })
    expect(query.page).toBe(2)
    expect(query.columnFilters).toEqual({ status: "error", "column-1": "plan" })
  })

  it("sorts up unless the search says down", () => {
    expect(recordsQueryOf({ sortBy: "column-1" }, 50).sortOrder).toBe("asc")
    expect(recordsQueryOf({ sortBy: "column-1", sortOrder: "desc" }, 50).sortOrder).toBe("desc")
  })
})

describe("searchWithFilter", () => {
  it("adds a column's text to the filters of the other columns, on the first page", () => {
    const search = searchWithFilter({ page: 3, filters: { a: "one" } }, "b", "two")
    expect(search).toEqual({ page: undefined, filters: { a: "one", b: "two" } })
  })

  it("replaces the text of a column already filtered", () => {
    expect(searchWithFilter({ filters: { a: "one" } }, "a", "two").filters).toEqual({ a: "two" })
  })

  it("takes a column's filter away with an empty text", () => {
    const search = searchWithFilter({ filters: { a: "one" } }, "a", "")
    expect(search.filters).toBeUndefined()
    expect(hasFilters(search)).toBe(false)
  })
})
