import {
  type FetchQueryOptions,
  noop,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query"

/**
 * Starts a query a loader does not wait for, as the loaders read theirs (`staleTime: "static"`):
 * the section that reads it waits in a `Suspense` of its own, and shows the query's error.
 */
export function startQuery<TData, TKey extends QueryKey>(
  queryClient: QueryClient,
  options: FetchQueryOptions<TData, Error, TData, TKey>,
): void {
  void queryClient.query({ ...options, staleTime: "static" }).catch(noop)
}
