import { QueryClient } from "@tanstack/react-query"
import { ApiError, ContractMismatchError } from "@/lib/api-client"
import { AuthenticationRequiredError } from "@/lib/auth/session"

/** Queries never retry a 4xx, a broken contract or an ended session; mutations never retry. */
function shouldRetryQuery(failureCount: number, error: Error): boolean {
  if (error instanceof ContractMismatchError || error instanceof AuthenticationRequiredError) {
    return false
  }
  if (error instanceof ApiError && error.status < 500) return false
  return failureCount < 3
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetryQuery },
      mutations: { retry: false },
    },
  })
}
