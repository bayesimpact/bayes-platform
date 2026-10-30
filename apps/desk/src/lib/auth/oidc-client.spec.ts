import { ErrorResponse } from "oidc-client-ts"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const userManagerMock = vi.hoisted(() => ({
  getUser: vi.fn(),
  signinSilent: vi.fn(),
  signinRedirect: vi.fn(),
  signinRedirectCallback: vi.fn(),
  signoutRedirect: vi.fn(),
  removeUser: vi.fn(),
  settings: {
    accessTokenExpiringNotificationTimeInSeconds: 60,
    authority: "https://idp.example.org",
    client_id: "platform-web",
  },
  events: { addAccessTokenExpiring: vi.fn() },
}))

vi.mock("oidc-client-ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("oidc-client-ts")>()),
  UserManager: vi.fn(function UserManager() {
    return userManagerMock
  }),
}))
vi.mock("@/app/config", () => ({ appConfig: { mode: "api" }, appBasePath: "/app/" }))
vi.mock("./oidc-settings", () => ({
  buildOidcSettings: () => ({}),
  OIDC_STORE_PREFIX: "desk.oidc.",
}))

const {
  AuthenticationRequiredError,
  completeSignIn,
  endSession,
  getAccessToken,
  hasSession,
  onSessionEnded,
  signIn,
  signOut,
  takeTabReturnTo,
} = await import("./oidc-client")

const expiredUser = { expired: true, expires_in: -5, access_token: "old", refresh_token: "r" }
const freshUser = { expired: false, expires_in: 3600, access_token: "fresh" }

type StorageListener = (event: { key: string; newValue: string | null }) => void
const storageListeners: StorageListener[] = []

/** The browser globals the client reads, with a session storage of this tab. */
const stubWindow = () => {
  const storage = new Map<string, string>()
  vi.stubGlobal("window", {
    location: { origin: "https://desk.test", assign: vi.fn() },
    addEventListener: (type: string, listener: StorageListener) => {
      if (type === "storage") storageListeners.push(listener)
    },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  })
}

beforeEach(() => {
  stubWindow()
  userManagerMock.getUser.mockReset()
  userManagerMock.signinSilent.mockReset()
  userManagerMock.signinRedirect.mockReset()
  userManagerMock.signinRedirectCallback.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("getAccessToken", () => {
  it("returns the stored token while it is valid", async () => {
    userManagerMock.getUser.mockResolvedValue(freshUser)
    await expect(getAccessToken()).resolves.toBe("fresh")
    expect(userManagerMock.signinSilent).not.toHaveBeenCalled()
  })

  it("refreshes an expired token, or a valid one when asked to", async () => {
    userManagerMock.getUser.mockResolvedValue(expiredUser)
    userManagerMock.signinSilent.mockResolvedValue({ access_token: "refreshed" })
    await expect(getAccessToken()).resolves.toBe("refreshed")

    userManagerMock.getUser.mockResolvedValue(freshUser)
    await expect(getAccessToken({ forceRefresh: true })).resolves.toBe("refreshed")
    expect(userManagerMock.signinSilent).toHaveBeenCalledTimes(2)
  })

  it("shares one refresh between concurrent callers", async () => {
    userManagerMock.getUser.mockResolvedValue(expiredUser)
    userManagerMock.signinSilent.mockResolvedValue({ access_token: "refreshed" })
    const tokens = await Promise.all([getAccessToken(), getAccessToken(), getAccessToken()])
    expect(tokens).toEqual(["refreshed", "refreshed", "refreshed"])
    expect(userManagerMock.signinSilent).toHaveBeenCalledTimes(1)
  })

  it("refreshes for a caller that forces it, even while a plain refresh goes on", async () => {
    // The plain refresh finds the token another tab stored, which the API refused to the other.
    userManagerMock.getUser.mockResolvedValueOnce(expiredUser).mockResolvedValue(freshUser)
    userManagerMock.signinSilent.mockResolvedValue({ access_token: "refreshed" })

    const [plain, forced] = await Promise.all([
      getAccessToken(),
      getAccessToken({ forceRefresh: true }),
    ])

    expect(plain).toBe("fresh")
    expect(forced).toBe("refreshed")
    expect(userManagerMock.signinSilent).toHaveBeenCalledTimes(1)
  })

  it("reuses the token another tab refreshed while this one waited for the lock", async () => {
    userManagerMock.getUser.mockResolvedValueOnce(expiredUser).mockResolvedValueOnce(freshUser)
    await expect(getAccessToken()).resolves.toBe("fresh")
    expect(userManagerMock.signinSilent).not.toHaveBeenCalled()
  })

  it("refreshes under a lock of the Desk's own, apart from apps/web's", async () => {
    const request = vi.fn((_name: string, task: () => Promise<string>) => task())
    vi.stubGlobal("navigator", { locks: { request } })
    userManagerMock.getUser.mockResolvedValue(expiredUser)
    userManagerMock.signinSilent.mockResolvedValue({ access_token: "refreshed" })
    await expect(getAccessToken()).resolves.toBe("refreshed")
    expect(request).toHaveBeenCalledWith("desk-oidc-token-refresh", expect.any(Function))
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

describe("hasSession", () => {
  it("counts an expired session that can still be refreshed", async () => {
    userManagerMock.getUser.mockResolvedValue(expiredUser)
    await expect(hasSession()).resolves.toBe(true)
    userManagerMock.getUser.mockResolvedValue({ ...expiredUser, refresh_token: undefined })
    await expect(hasSession()).resolves.toBe(false)
    userManagerMock.getUser.mockResolvedValue(null)
    await expect(hasSession()).resolves.toBe(false)
  })
})

describe("background renewal", () => {
  const renewBeforeExpiry = () => {
    const listener = userManagerMock.events.addAccessTokenExpiring.mock.calls[0]?.[0]
    if (typeof listener !== "function") throw new Error("No expiring listener registered")
    listener()
  }

  it("refreshes a token about to expire, once even if the event fires twice", async () => {
    userManagerMock.getUser.mockResolvedValue({ expired: false, expires_in: 30, access_token: "x" })
    userManagerMock.signinSilent.mockResolvedValue({ access_token: "renewed" })

    renewBeforeExpiry()
    renewBeforeExpiry()
    await vi.waitFor(() => expect(userManagerMock.signinSilent).toHaveBeenCalledTimes(1))
  })

  it("waits before retrying after a failed renewal", async () => {
    vi.useFakeTimers()
    const reportError = vi.spyOn(console, "error").mockImplementation(() => {})
    userManagerMock.getUser.mockResolvedValue({ expired: false, expires_in: 30, access_token: "x" })
    userManagerMock.signinSilent.mockRejectedValue(new TypeError("Failed to fetch"))

    renewBeforeExpiry()
    await vi.waitFor(() => expect(reportError).toHaveBeenCalledTimes(1))
    renewBeforeExpiry()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(userManagerMock.signinSilent).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(15_000)
    renewBeforeExpiry()
    await vi.waitFor(() => expect(userManagerMock.signinSilent).toHaveBeenCalledTimes(2))
    vi.useRealTimers()
    reportError.mockRestore()
  })
})

describe("signing in and coming back", () => {
  it("sends the page to return to in the OIDC state, with the login hint", async () => {
    await signIn({ returnTo: "/app/o/1/p/2?tab=agents", loginHint: "user@example.org" })
    expect(userManagerMock.signinRedirect).toHaveBeenCalledWith({
      state: { returnTo: "/app/o/1/p/2?tab=agents" },
      login_hint: "user@example.org",
    })
  })

  it("opens the page of the state once the sign-in completes", async () => {
    userManagerMock.signinRedirectCallback.mockResolvedValue({ state: { returnTo: "/app/o/1" } })
    await expect(completeSignIn()).resolves.toBe("/app/o/1")
  })

  it("opens the home for a page on another origin, of another app, or no state", async () => {
    for (const state of [
      { returnTo: "//evil.example/app/" },
      { returnTo: "/studio/x" },
      undefined,
    ]) {
      userManagerMock.signinRedirectCallback.mockResolvedValue({ state })
      await expect(completeSignIn()).resolves.toBe("/app/")
    }
  })

  it("keeps the page of the tab's last sign-in, once, until the sign-in completes", async () => {
    await signIn({ returnTo: "/app/o/1" })
    expect(takeTabReturnTo()).toBe("/app/o/1")
    expect(takeTabReturnTo()).toBeNull()

    await signIn({ returnTo: "/app/o/1" })
    userManagerMock.signinRedirectCallback.mockResolvedValue({ state: { returnTo: "/app/o/1" } })
    await completeSignIn()
    expect(takeTabReturnTo()).toBeNull()
  })
})

describe("the end of a session", () => {
  it("is reported when the session is forgotten and when another tab removes it", async () => {
    userManagerMock.getUser.mockResolvedValue(freshUser)
    await hasSession()
    const listener = vi.fn()
    const unsubscribe = onSessionEnded(listener)

    await endSession()
    expect(userManagerMock.removeUser).toHaveBeenCalled()
    expect(listener).toHaveBeenCalledTimes(1)

    for (const storageListener of storageListeners) {
      storageListener({
        key: "desk.oidc.user:https://idp.example.org:platform-web",
        newValue: null,
      })
      storageListener({ key: "oidc.user:https://idp.example.org:platform-web", newValue: null })
    }
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
  })
})

// Last: signing out lasts until the page leaves, which a test's page never does.
describe("signing out", () => {
  it("reads no session until the page leaves, so nothing starts a new sign-in", async () => {
    userManagerMock.getUser.mockResolvedValue(freshUser)
    const listener = vi.fn()
    const unsubscribe = onSessionEnded(listener)

    await signOut()
    const settled = vi.fn()
    void hasSession().then(settled, settled)
    void getAccessToken().then(settled, settled)
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(userManagerMock.signoutRedirect).toHaveBeenCalledWith({ id_token_hint: undefined })
    expect(settled).not.toHaveBeenCalled()
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })
})
