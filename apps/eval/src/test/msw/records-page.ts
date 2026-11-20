/** What the mocked API reads of a records query: the page, the filters and the order. */
type RecordsQuery = {
  page: number
  limit: number
  columnFilters?: string
  sortBy?: string
  sortOrder?: "asc" | "desc"
}

/**
 * A page of records as the API returns it: narrowed to those whose values hold each filter's
 * text, whatever its case, sorted by a key, then cut to the page. `textOf` reads the value of a
 * record under a key of the query.
 */
export function pageOfRecords<TRecord>(
  records: TRecord[],
  query: RecordsQuery,
  textOf: (record: TRecord, key: string) => string,
) {
  const filters: Record<string, string> = query.columnFilters ? JSON.parse(query.columnFilters) : {}
  const kept = records.filter((record) =>
    Object.entries(filters).every(([key, text]) =>
      textOf(record, key).toLowerCase().includes(text.toLowerCase()),
    ),
  )
  const { sortBy } = query
  if (sortBy) {
    const direction = query.sortOrder === "asc" ? 1 : -1
    kept.sort(
      (first, second) => direction * textOf(first, sortBy).localeCompare(textOf(second, sortBy)),
    )
  }
  const start = query.page * query.limit
  return {
    records: kept.slice(start, start + query.limit),
    total: kept.length,
    page: query.page,
    limit: query.limit,
  }
}
