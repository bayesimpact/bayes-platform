import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/session", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {},
}))

const { ApiError, ContractMismatchError } = await import("@/lib/api-client")
const { AuthenticationRequiredError } = await import("@/lib/auth/session")
const { createQueryClient } = await import("./query-client")

const retry = createQueryClient().getDefaultOptions().queries?.retry
const shouldRetry = (failureCount: number, error: Error) =>
  typeof retry === "function" ? retry(failureCount, error) : retry

describe("createQueryClient", () => {
  it("retries a server error or a network failure, three times", () => {
    expect(shouldRetry(0, new ApiError(503, null))).toBe(true)
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true)
    expect(shouldRetry(3, new ApiError(503, null))).toBe(false)
  })

  it("never retries a 4xx, a broken contract or an ended session", () => {
    expect(shouldRetry(0, new ApiError(404, null))).toBe(false)
    expect(shouldRetry(0, new ContractMismatchError("GET /desk/me"))).toBe(false)
    expect(shouldRetry(0, new AuthenticationRequiredError("gone"))).toBe(false)
  })

  it("never retries a mutation", () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false)
  })
})
