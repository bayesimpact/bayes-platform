import { QueryClient } from "@tanstack/react-query"
import { ApiError, ContractMismatchError, InvalidRequestError } from "@/lib/api-client"
import {
  AuthenticationRequiredError,
  SignInLoopError,
  SignInRefusedError,
} from "@/lib/auth/session"

/**
 * Queries never retry a 4xx, a broken contract either way, an ended session or a refused sign-in;
 * mutations never retry.
 */
function shouldRetryQuery(failureCount: number, error: Error): boolean {
  if (
    error instanceof ContractMismatchError ||
    error instanceof InvalidRequestError ||
    error instanceof AuthenticationRequiredError ||
    error instanceof SignInRefusedError ||
    error instanceof SignInLoopError
  ) {
    return false
  }
  if (error instanceof ApiError && error.status < 500) return false
  return failureCount < 3
}

export type QueryClientOptions = {
  /** Whether a failed query retries: off in the tests and the stories, so a failure shows at once. */
  isRetrying?: boolean
}

export function createQueryClient({ isRetrying = true }: QueryClientOptions = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: isRetrying ? shouldRetryQuery : false },
      mutations: { retry: false },
    },
  })
}
