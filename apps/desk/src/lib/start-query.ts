import {
  type FetchQueryOptions,
  noop,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query"

/**
 * How the loaders read their queries: the cached data as it is, with no new request, unless a
 * mutation invalidated it. `"static"` alone would ignore the invalidation of a query no component
 * observes, and the next page would show what the mutation changed as it was before.
 */
export const loaderStaleTime = (query: { state: { isInvalidated: boolean } }) =>
  query.state.isInvalidated ? 0 : ("static" as const)

/**
 * Starts a query a loader does not wait for, as the loaders read theirs (`loaderStaleTime`): the
 * section that reads it waits in a `Suspense` of its own, and shows the query's error.
 */
export function startQuery<TData, TKey extends QueryKey>(
  queryClient: QueryClient,
  options: FetchQueryOptions<TData, Error, TData, TKey>,
): void {
  void queryClient.query({ ...options, staleTime: loaderStaleTime }).catch(noop)
}
