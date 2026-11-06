import { describe, expect, it } from "vitest"
import {
  adoptDeskSession,
  buildOidcSettings,
  DEFAULT_OIDC_SCOPE,
  sessionStorageKey,
} from "./oidc-settings"

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

const config = {
  oidcAuthority: "https://idp.example.org/realms/acme",
  oidcClientId: "platform-web",
  oidcAudience: undefined,
  oidcScope: undefined,
  oidcAuthorizationParams: {},
}

describe("buildOidcSettings", () => {
  const appUrl = "https://platform.example.org/app/"

  it("comes back to the Desk's callback after sign-in and to its home after sign-out", () => {
    const settings = buildOidcSettings(config, appUrl, memoryStorage())

    expect(settings).toMatchObject({
      authority: "https://idp.example.org/realms/acme",
      client_id: "platform-web",
      redirect_uri: "https://platform.example.org/app/auth/callback",
      post_logout_redirect_uri: "https://platform.example.org/app/",
      response_type: "code",
      scope: DEFAULT_OIDC_SCOPE,
      automaticSilentRenew: false,
    })
    expect(settings.extraQueryParams).toBeUndefined()
  })

  it("keeps its session under the key apps/web uses, and its sign-in state apart", async () => {
    const storage = memoryStorage()
    const settings = buildOidcSettings(config, appUrl, storage)

    await settings.userStore?.set("user:https://idp.example.org/realms/acme:platform-web", "user")
    await settings.stateStore?.set("state-id", "state")

    expect(storage.getItem(sessionStorageKey(settings))).toBe("user")
    expect(storage.getItem("oidc.user:https://idp.example.org/realms/acme:platform-web")).toBe(
      "user",
    )
    expect(storage.getItem("desk.oidc.state-id")).toBe("state")
  })

  it("sends the audience, the authorization parameters and a custom scope when configured", () => {
    const settings = buildOidcSettings(
      {
        ...config,
        oidcAudience: "https://api.example.org",
        oidcScope: "openid email",
        oidcAuthorizationParams: { organization: "org_123" },
      },
      appUrl,
      memoryStorage(),
    )

    expect(settings.extraQueryParams).toEqual({
      organization: "org_123",
      audience: "https://api.example.org",
    })
    expect(settings.scope).toBe("openid email")
  })
})

describe("adoptDeskSession", () => {
  const settings = { authority: "https://idp.example.org", client_id: "platform-web" }
  const deskKey = "desk.oidc.user:https://idp.example.org:platform-web"
  const sharedKey = "oidc.user:https://idp.example.org:platform-web"

  it("makes the Desk's own session the shared one when there is none", () => {
    const storage = memoryStorage()
    storage.setItem(deskKey, "desk session")

    adoptDeskSession(settings, storage)

    expect(storage.getItem(sharedKey)).toBe("desk session")
    expect(storage.getItem(deskKey)).toBeNull()
  })

  it("keeps the shared session, and forgets the Desk's own", () => {
    const storage = memoryStorage()
    storage.setItem(sharedKey, "shared session")
    storage.setItem(deskKey, "desk session")

    adoptDeskSession(settings, storage)

    expect(storage.getItem(sharedKey)).toBe("shared session")
    expect(storage.getItem(deskKey)).toBeNull()
  })
})
