/** Polling stops after this many failures in a row, and the query's error then shows. */
const MAX_FAILURES_IN_A_ROW = 3

/** What `pollWhile` reads of a query: the data it holds, and its failures in a row. */
type PolledQuery<TData> = { state: { data: TData | undefined; fetchFailureCount: number } }

/**
 * The `refetchInterval` of a query that polls while its data still changes: every
 * `intervalInMilliseconds` while `isLive(data)` holds and the tab is visible, and no more after
 * three failures in a row. The query decides from its own data, whoever reads it.
 */
export function pollWhile<TData>(
  isLive: (data: TData | undefined) => boolean,
  intervalInMilliseconds: number,
): (query: PolledQuery<TData>) => number | false {
  return (query) =>
    query.state.fetchFailureCount < MAX_FAILURES_IN_A_ROW && isLive(query.state.data)
      ? intervalInMilliseconds
      : false
}
