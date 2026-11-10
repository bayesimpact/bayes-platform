import { APICallError } from "@ai-sdk/provider"
import { RetryError } from "ai"
import { errors as undiciErrors } from "undici"

/**
 * Failures shaped like the real ones, for specs that drive
 * {@link AISDKMockProvider.addErrorTurn}. The retry classifier has to read
 * both shapes: a bare undici error (a failure while the body is read), and an
 * `APICallError` wrapping it under `cause` (what the AI SDK builds for
 * connection and header failures).
 */

const MOCK_URL = "https://mock.invalid/v1/generate"

function asApiCallError(cause: Error): APICallError {
  return new APICallError({
    message: `Cannot connect to API: ${cause.message}`,
    url: MOCK_URL,
    requestBodyValues: {},
    cause,
    isRetryable: true,
  })
}

/** Connection never established (UND_ERR_CONNECT_TIMEOUT). */
export function connectTimeoutError(): APICallError {
  return asApiCallError(new undiciErrors.ConnectTimeoutError())
}

/** Connected, but no response headers in time (UND_ERR_HEADERS_TIMEOUT). */
export function headersTimeoutError(): APICallError {
  return asApiCallError(new undiciErrors.HeadersTimeoutError())
}

/** Body read timed out (UND_ERR_BODY_TIMEOUT), surfacing unwrapped. */
export function bareBodyTimeoutError(): Error {
  return new undiciErrors.BodyTimeoutError()
}

/** The provider has no capacity left for the requested tier. */
export function rateLimitError(): APICallError {
  return new APICallError({
    message: "Too Many Requests",
    url: MOCK_URL,
    requestBodyValues: {},
    statusCode: 429,
    responseBody: '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","message":"Quota exceeded"}}',
    isRetryable: true,
  })
}

/** A malformed request: retrying it would fail the same way, so it is never retried. */
export function invalidArgumentError(): APICallError {
  return new APICallError({
    message: "Invalid argument",
    url: MOCK_URL,
    requestBodyValues: {},
    statusCode: 400,
    responseBody: '{"error":{"code":400,"status":"INVALID_ARGUMENT","message":"Invalid argument"}}',
    isRetryable: false,
  })
}

/** What the AI SDK's own retry loop throws once it gives up. */
export function wrappedInRetryError(...errors: Error[]): RetryError {
  return new RetryError({
    message: `Failed after ${errors.length} attempts`,
    reason: "maxRetriesExceeded",
    errors,
  })
}
