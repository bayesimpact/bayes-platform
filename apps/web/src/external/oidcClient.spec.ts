import { ErrorResponse, type User } from "oidc-client-ts"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const userManagerMock = vi.hoisted(() => ({
  getUser: vi.fn(),
  signinSilent: vi.fn(),
  signinRedirect: vi.fn(),
  settings: { accessTokenExpiringNotificationTimeInSeconds: 60 },
  events: { addAccessTokenExpiring: vi.fn() },
}))

vi.mock("oidc-client-ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("oidc-client-ts")>()),
  UserManager: vi.fn(function UserManager() {
    return userManagerMock
  }),
}))
vi.mock("@/config/oidc.config", () => ({ getOidcSettings: () => ({}) }))

const {
  AuthenticationRequiredError,
  getAccessToken,
  getUserManager,
  login,
  rememberSigninReturnTo,
  takeSigninReturnTo,
} = await import("./oidcClient")

const expiredUser = { expired: true, expires_in: -5, access_token: "old" }
const freshUser = { expired: false, expires_in: 3600, access_token: "fresh" }

describe("getAccessToken", () => {
  beforeEach(() => {
    userManagerMock.getUser.mockReset()
    userManagerMock.signinSilent.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns the stored token while it is valid", async () => {
    userManagerMock.getUser.mockResolvedValue(freshUser)
    await expect(getAccessToken()).resolves.toBe("fresh")
    expect(userManagerMock.signinSilent).not.toHaveBeenCalled()
  })

  it("refreshes an expired token", async () => {
    userManagerMock.getUser.mockResolvedValue(expiredUser)
    userManagerMock.signinSilent.mockResolvedValue({ access_token: "refreshed" })
    await expect(getAccessToken()).resolves.toBe("refreshed")
  })

  it("shares one refresh between concurrent callers", async () => {
    userManagerMock.getUser.mockResolvedValue(expiredUser)
    userManagerMock.signinSilent.mockResolvedValue({ access_token: "refreshed" })
    const tokens = await Promise.all([getAccessToken(), getAccessToken(), getAccessToken()])
    expect(tokens).toEqual(["refreshed", "refreshed", "refreshed"])
    expect(userManagerMock.signinSilent).toHaveBeenCalledTimes(1)
  })

  it("reuses the token another tab refreshed while this one waited for the lock", async () => {
    userManagerMock.getUser.mockResolvedValueOnce(expiredUser).mockResolvedValueOnce(freshUser)
    await expect(getAccessToken()).resolves.toBe("fresh")
    expect(userManagerMock.signinSilent).not.toHaveBeenCalled()
  })

  it("refreshes under a lock shared by all tabs", async () => {
    const request = vi.fn((_name: string, task: () => Promise<string>) => task())
    vi.stubGlobal("navigator", { locks: { request } })
    userManagerMock.getUser.mockResolvedValue(expiredUser)
    userManagerMock.signinSilent.mockResolvedValue({ access_token: "refreshed" })
    await expect(getAccessToken()).resolves.toBe("refreshed")
    expect(request).toHaveBeenCalledWith("oidc-token-refresh", expect.any(Function))
  })

  it("ends the session when the provider refuses the refresh token", async () => {
    userManagerMock.getUser.mockResolvedValue(expiredUser)
    userManagerMock.signinSilent.mockRejectedValue(
      new ErrorResponse({
        error: "invalid_grant",
        error_description: "Unknown or invalid refresh token.",
      }),
    )
    await expect(getAccessToken()).rejects.toBeInstanceOf(AuthenticationRequiredError)
  })

  it("keeps the session when the provider cannot be reached", async () => {
    userManagerMock.getUser.mockResolvedValue(expiredUser)
    userManagerMock.signinSilent.mockRejectedValue(new TypeError("Failed to fetch"))
    const error = await getAccessToken().catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(TypeError)
    expect(error).not.toBeInstanceOf(AuthenticationRequiredError)
  })
})

describe("background renewal", () => {
  it("refreshes a token about to expire, once even if the event fires twice", async () => {
    getUserManager()
    const renewBeforeExpiry = userManagerMock.events.addAccessTokenExpiring.mock.calls[0]?.[0]
    userManagerMock.getUser.mockReset().mockResolvedValue({
      expired: false,
      expires_in: 30,
      access_token: "expiring",
    })
    userManagerMock.signinSilent.mockReset().mockResolvedValue({ access_token: "renewed" })

    renewBeforeExpiry()
    renewBeforeExpiry()
    await vi.waitFor(() => expect(userManagerMock.signinSilent).toHaveBeenCalledTimes(1))
  })

  it("waits before retrying after a failed renewal", async () => {
    vi.useFakeTimers()
    const renewBeforeExpiry = userManagerMock.events.addAccessTokenExpiring.mock.calls[0]?.[0]
    vi.spyOn(console, "warn").mockImplementation(() => {})
    userManagerMock.signinSilent.mockReset().mockRejectedValue(new TypeError("Failed to fetch"))

    renewBeforeExpiry()
    await vi.waitFor(() => expect(console.warn).toHaveBeenCalledTimes(1))
    renewBeforeExpiry()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(userManagerMock.signinSilent).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(15_000)
    renewBeforeExpiry()
    await vi.waitFor(() => expect(userManagerMock.signinSilent).toHaveBeenCalledTimes(2))
    vi.useRealTimers()
  })
})

describe("return to the page after sign-in", () => {
  const stubLocation = (pathname: string, search = "", hash = "") =>
    vi.stubGlobal("window", { location: { origin: "https://app.test", pathname, search, hash } })

  beforeEach(() => {
    userManagerMock.signinRedirect.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("sends the current page in the OIDC state", async () => {
    stubLocation("/studio/projects/1", "?tab=agents", "#top")
    await login({ loginHint: "user@example.org" })
    expect(userManagerMock.signinRedirect).toHaveBeenCalledWith({
      login_hint: "user@example.org",
      state: { returnTo: "/studio/projects/1?tab=agents#top" },
    })
  })

  it("sends no page from the app root", async () => {
    stubLocation("/", "?login_hint=user%40example.org")
    await login()
    expect(userManagerMock.signinRedirect).toHaveBeenCalledWith({})
  })

  it("returns to the page once", () => {
    rememberSigninReturnTo({ state: { returnTo: "/desk/chats" } } as User)
    expect(takeSigninReturnTo()).toBe("/desk/chats")
    expect(takeSigninReturnTo()).toBeNull()
  })

  it("ignores a page on another origin or a missing state", () => {
    rememberSigninReturnTo({ state: { returnTo: "//evil.example/path" } } as User)
    expect(takeSigninReturnTo()).toBeNull()
    rememberSigninReturnTo({ state: { returnTo: "https://evil.example" } } as User)
    expect(takeSigninReturnTo()).toBeNull()
    rememberSigninReturnTo({ state: undefined } as User)
    expect(takeSigninReturnTo()).toBeNull()
  })
})
