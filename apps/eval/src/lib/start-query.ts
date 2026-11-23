/**
 * How the loaders read their queries: the cached data as it is, with no new request, unless a
 * mutation invalidated it. `"static"` alone would ignore the invalidation of a query no component
 * observes, and the next page would show what the mutation changed as it was before.
 */
export const loaderStaleTime = (query: { state: { isInvalidated: boolean } }) =>
  query.state.isInvalidated ? 0 : ("static" as const)
