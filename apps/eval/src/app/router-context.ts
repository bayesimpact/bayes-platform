import type { QueryClient } from "@tanstack/react-query"

/** What every route's loader receives in its context. */
export type RouterContext = {
  queryClient: QueryClient
}
