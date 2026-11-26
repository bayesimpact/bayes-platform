import { QueryClient } from "@tanstack/react-query"
import { shouldRetryQuery } from "@/lib/api-client"

export type QueryClientOptions = {
  /** Whether a failed query retries: off in the tests and the stories, so a failure shows at once. */
  isRetrying?: boolean
}

/** Queries retry as `shouldRetryQuery` says; mutations never retry. */
export function createQueryClient({ isRetrying = true }: QueryClientOptions = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: isRetrying ? shouldRetryQuery : false },
      mutations: { retry: false },
    },
  })
}
