import {
  AuthenticationRequiredError,
  SignInLoopError,
  SignInRefusedError,
} from "@bayes-platform/sign-in"
import { describe, expect, it } from "vitest"
import { ApiError, ContractMismatchError, InvalidRequestError } from "./api-client"
import { shouldRetryQuery } from "./query-retry"

describe("shouldRetryQuery", () => {
  it("retries a server error or a network failure, three times", () => {
    expect(shouldRetryQuery(0, new ApiError(503, null))).toBe(true)
    expect(shouldRetryQuery(0, new TypeError("Failed to fetch"))).toBe(true)
    expect(shouldRetryQuery(3, new ApiError(503, null))).toBe(false)
  })

  it("never retries a 4xx, a broken contract, an ended session or a refused sign-in", () => {
    expect(shouldRetryQuery(0, new ApiError(404, null))).toBe(false)
    expect(shouldRetryQuery(0, new ContractMismatchError("GET /projects/mine"))).toBe(false)
    expect(shouldRetryQuery(0, new InvalidRequestError("GET /projects/mine", null))).toBe(false)
    expect(shouldRetryQuery(0, new AuthenticationRequiredError("gone"))).toBe(false)
    expect(shouldRetryQuery(0, new SignInRefusedError("emailRequired"))).toBe(false)
    expect(shouldRetryQuery(0, new SignInLoopError())).toBe(false)
  })
})
