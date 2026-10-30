import { describe, expect, it } from "vitest"
import { buildOidcSettings, DEFAULT_OIDC_SCOPE } from "./oidc-settings"

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

  it("keeps its session under a prefix of its own, apart from apps/web's", async () => {
    const storage = memoryStorage()
    const settings = buildOidcSettings(config, appUrl, storage)

    await settings.userStore?.set("user:key", "value")

    expect(storage.getItem("desk.oidc.user:key")).toBe("value")
    expect(storage.getItem("oidc.user:key")).toBeNull()
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
