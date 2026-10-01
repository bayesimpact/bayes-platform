import { describe, expect, it } from "vitest"
import { buildOidcSettings, DEFAULT_OIDC_SCOPE } from "./oidc.config"

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

describe("buildOidcSettings", () => {
  const appUrl = "https://platform.example.org"

  it("uses the authorization code flow with the app root as redirect", () => {
    const settings = buildOidcSettings(
      { oidcAuthority: "https://idp.example.org/realms/acme", oidcClientId: "platform-web" },
      appUrl,
      memoryStorage(),
    )

    expect(settings).toMatchObject({
      authority: "https://idp.example.org/realms/acme",
      client_id: "platform-web",
      redirect_uri: appUrl,
      post_logout_redirect_uri: appUrl,
      response_type: "code",
      scope: DEFAULT_OIDC_SCOPE,
    })
    expect(settings.extraQueryParams).toBeUndefined()
  })

  it("sends the audience and a custom scope when configured", () => {
    const settings = buildOidcSettings(
      {
        oidcAuthority: "https://tenant.example.org/",
        oidcClientId: "platform-web",
        oidcAudience: "https://api.example.org",
        oidcScope: "openid email",
      },
      appUrl,
      memoryStorage(),
    )

    expect(settings.extraQueryParams).toEqual({ audience: "https://api.example.org" })
    expect(settings.scope).toBe("openid email")
  })

  it("adds the configured authorization parameters, such as an Auth0 organization", () => {
    const settings = buildOidcSettings(
      {
        oidcAuthority: "https://tenant.example.org/",
        oidcClientId: "platform-web",
        oidcAudience: "https://api.example.org",
        oidcAuthorizationParams: '{"organization":"org_123"}',
      },
      appUrl,
      memoryStorage(),
    )

    expect(settings.extraQueryParams).toEqual({
      organization: "org_123",
      audience: "https://api.example.org",
    })
  })

  it("ignores malformed authorization parameters", () => {
    const settings = buildOidcSettings(
      {
        oidcAuthority: "https://tenant.example.org/",
        oidcClientId: "platform-web",
        oidcAuthorizationParams: "organization=org_123",
      },
      appUrl,
      memoryStorage(),
    )

    expect(settings.extraQueryParams).toBeUndefined()
  })
})
