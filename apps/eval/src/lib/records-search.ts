import { z } from "zod"

/**
 * The search params of a table of records the API pages: the page, counted from 0, the column
 * the API sorts by, and the text it looks for in one column.
 */
export const recordsSearchSchema = z.object({
  page: z.number().int().min(0).optional().catch(undefined),
  sortBy: z.string().optional().catch(undefined),
  sortOrder: z.enum(["asc", "desc"]).optional().catch(undefined),
  /** The column the search looks in, and the text it looks for. */
  searchIn: z.string().optional().catch(undefined),
  search: z.string().optional().catch(undefined),
})

/** Which records of a table show: its page, its order and its search. */
export type RecordsSearch = z.output<typeof recordsSearchSchema>

/** A search with nothing in it: the first page, in the order of the API. */
export const NO_RECORDS_SEARCH = {
  page: undefined,
  sortBy: undefined,
  sortOrder: undefined,
  searchIn: undefined,
  search: undefined,
} satisfies RecordsSearch

/**
 * What a records search asks the API: the page, the order, and the filters as the JSON object the
 * API reads, with those the caller adds.
 */
export function recordsQueryOf(
  { page, sortBy, sortOrder, searchIn, search }: RecordsSearch,
  limit: number,
  moreFilters: Record<string, string> = {},
) {
  const filters = { ...moreFilters, ...(searchIn && search ? { [searchIn]: search } : {}) }
  return {
    page: page ?? 0,
    limit,
    columnFilters: Object.keys(filters).length > 0 ? JSON.stringify(filters) : undefined,
    sortBy,
    sortOrder: sortBy ? (sortOrder ?? "asc") : undefined,
  }
}

/** The order of a records search, as TanStack Table holds a sorting. */
export const sortingOf = ({ sortBy, sortOrder }: RecordsSearch) =>
  sortBy ? [{ id: sortBy, desc: sortOrder === "desc" }] : []

/**
 * The search after the person asked another order, or another search: the first page of it, as
 * the rows of the page shown are no longer the same.
 */
export function searchWithSort(
  search: RecordsSearch,
  sorting: { id: string; desc: boolean }[],
): RecordsSearch {
  const [next] = sorting
  return {
    ...search,
    page: undefined,
    sortBy: next?.id,
    sortOrder: next ? (next.desc ? "desc" : "asc") : undefined,
  }
}
