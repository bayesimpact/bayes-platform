import { z } from "zod"

/**
 * The search params of a table of records the API pages: the page, counted from 0, the column
 * the API sorts by, and the texts it looks for, one per column, all at once.
 */
export const recordsSearchSchema = z.object({
  page: z.number().int().min(0).optional().catch(undefined),
  sortBy: z.string().optional().catch(undefined),
  sortOrder: z.enum(["asc", "desc"]).optional().catch(undefined),
  /** The text each column must hold, by the key the API knows the column by. */
  filters: z.record(z.string(), z.string()).optional().catch(undefined),
})

/** Which records of a table show: its page, its order and its filters. */
export type RecordsSearch = z.output<typeof recordsSearchSchema>

/** A search with nothing in it: the first page, in the order of the API. */
export const NO_RECORDS_SEARCH = {
  page: undefined,
  sortBy: undefined,
  sortOrder: undefined,
  filters: undefined,
} satisfies RecordsSearch

/**
 * What a records search asks the API: the page, the order, and the filters, with those the caller
 * adds.
 */
export function recordsQueryOf(
  { page, sortBy, sortOrder, filters }: RecordsSearch,
  limit: number,
  moreFilters: Record<string, string> = {},
) {
  const allFilters = { ...filters, ...moreFilters }
  return {
    page: page ?? 0,
    limit,
    columnFilters: Object.keys(allFilters).length > 0 ? allFilters : undefined,
    sortBy,
    sortOrder: sortBy ? (sortOrder ?? "asc") : undefined,
  }
}

/** The order of a records search, as TanStack Table holds a sorting. */
export const sortingOf = ({ sortBy, sortOrder }: RecordsSearch) =>
  sortBy ? [{ id: sortBy, desc: sortOrder === "desc" }] : []

/**
 * The search after the person asked another order: the first page of it, as the rows of the page
 * shown are no longer the same.
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

/**
 * The search after the person set the text a column must hold, or took it away with an empty
 * text: the first page of it, with the filters of the other columns kept.
 */
export function searchWithFilter(
  search: RecordsSearch,
  column: string,
  text: string,
): RecordsSearch {
  const { [column]: _replaced, ...others } = search.filters ?? {}
  const filters = text === "" ? others : { ...others, [column]: text }
  return {
    ...search,
    page: undefined,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  }
}

/** Whether a search narrows the records: it holds a filter. */
export const hasFilters = (search: RecordsSearch) => Object.keys(search.filters ?? {}).length > 0
