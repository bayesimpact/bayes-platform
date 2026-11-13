import { User } from "oidc-client-ts"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Two apps of one origin, each with its own OIDC client, on the real oidc-client-ts: this app at
 * `/eval/` and the Desk at `/app/`, which signs in the same way. They share the browser's
 * storage and its Web Locks, and the provider rotates the refresh token on every refresh.
 */

const authority = "https://idp.example.org"
const clientId = "platform-web"
const sessionKey = `oidc.user:${authority}:${clientId}`

const memoryStorage = (): Storage => {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key)
    },
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

/** The browser's Web Locks: one task at a time per name, for every app of the origin. */
const webLocks = () => {
  const tails = new Map<string, Promise<unknown>>()
  return {
    request: (name: string, task: () => Promise<unknown>) => {
      const run = (tails.get(name) ?? Promise.resolve()).then(task)
      tails.set(
        name,
        run.catch(() => undefined),
      )
      return run
    },
  }
}

/** A provider that rotates the refresh token, and refuses one already used. */
const rotatingProvider = () => {
  let generation = 0
  const refreshRequests: string[] = []
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith("/.well-known/openid-configuration")) {
      return json({
        issuer: authority,
        authorization_endpoint: `${authority}/authorize`,
        token_endpoint: `${authority}/token`,
      })
    }
    const refreshToken = new URLSearchParams(String(init?.body)).get("refresh_token") ?? ""
    refreshRequests.push(refreshToken)
    if (refreshToken !== `refresh-${generation}`) return json({ error: "invalid_grant" }, 400)
    generation += 1
    return json({
      access_token: `access-${generation}`,
      refresh_token: `refresh-${generation}`,
      token_type: "Bearer",
      expires_in: 3600,
    })
  }
  return { fetch, refreshRequests }
}

const storeExpiredSession = (storage: Storage) => {
  const user = new User({
    access_token: "access-0",
    refresh_token: "refresh-0",
    token_type: "Bearer",
    expires_at: Math.floor(Date.now() / 1000) - 10,
    profile: { sub: "person", iss: authority, aud: clientId, exp: 0, iat: 0 },
  })
  storage.setItem(sessionKey, user.toStorageString())
}

/** One app's sign-in module, loaded apart from the other's, as two apps' bundles are. */
const loadApp = async (appBasePath: string) => {
  vi.resetModules()
  vi.doMock("@/app/config", () => ({
    appConfig: {
      mode: "api",
      oidcAuthority: authority,
      oidcClientId: clientId,
      oidcAuthorizationParams: {},
    },
    appBasePath,
  }))
  return await import("./oidc-client")
}

let storage: Storage
let provider: ReturnType<typeof rotatingProvider>

beforeEach(() => {
  storage = memoryStorage()
  provider = rotatingProvider()
  vi.stubGlobal("window", {
    location: { origin: "https://platform.example.org" },
    localStorage: storage,
    sessionStorage: memoryStorage(),
    addEventListener: () => {},
  })
  vi.stubGlobal("navigator", { locks: webLocks() })
  vi.stubGlobal("fetch", provider.fetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.doUnmock("@/app/config")
})

describe("one session shared by the apps of an origin", () => {
  it("is open in an app as soon as another one signed in", async () => {
    storage.setItem(
      sessionKey,
      new User({
        access_token: "signed-in-elsewhere",
        token_type: "Bearer",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        profile: { sub: "person", iss: authority, aud: clientId, exp: 0, iat: 0 },
      }).toStorageString(),
    )
    const desk = await loadApp("/app/")

    await expect(desk.hasSession()).resolves.toBe(true)
    await expect(desk.getAccessToken()).resolves.toBe("signed-in-elsewhere")
  })

  it("is refreshed once when two apps refresh it at the same time", async () => {
    storeExpiredSession(storage)
    const desk = await loadApp("/app/")
    const evaluation = await loadApp("/eval/")

    const tokens = await Promise.all([
      desk.getAccessToken(),
      evaluation.getAccessToken(),
      desk.getAccessToken(),
      evaluation.getAccessToken(),
    ])

    expect(tokens).toEqual(["access-1", "access-1", "access-1", "access-1"])
    expect(provider.refreshRequests).toEqual(["refresh-0"])
    expect(User.fromStorageString(storage.getItem(sessionKey) ?? "").refresh_token).toBe(
      "refresh-1",
    )
  })
})
