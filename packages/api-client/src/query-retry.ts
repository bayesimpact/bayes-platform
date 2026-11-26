import {
  AuthenticationRequiredError,
  SignInLoopError,
  SignInRefusedError,
} from "@bayes-platform/sign-in"
import { ApiError, ContractMismatchError, InvalidRequestError } from "./api-client"

/**
 * Whether a failed query retries, for TanStack Query's `retry` option. A query never retries a 4xx,
 * a broken contract either way, an ended session or a refused sign-in, and retries any other
 * failure, such as a 5xx or a network failure, three times.
 */
export function shouldRetryQuery(failureCount: number, error: Error): boolean {
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
