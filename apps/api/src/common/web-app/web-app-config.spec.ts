import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildWebAppRuntimeConfig, getWebAppSettings } from "./web-app-config"

describe("getWebAppSettings", () => {
  it("is disabled when WEB_APP_DIST_DIR is unset", () => {
    expect(getWebAppSettings({})).toBeNull()
  })

  it("is disabled when the folder has no index.html", () => {
    const distDir = mkdtempSync(join(tmpdir(), "web-app-"))
    expect(getWebAppSettings({ WEB_APP_DIST_DIR: distDir })).toBeNull()
  })

  it("points to index.html when the build is present", () => {
    const distDir = mkdtempSync(join(tmpdir(), "web-app-"))
    writeFileSync(join(distDir, "index.html"), "<html></html>")
    expect(getWebAppSettings({ WEB_APP_DIST_DIR: distDir })).toEqual({
      distDir,
      indexHtmlPath: join(distDir, "index.html"),
    })
  })
})

describe("buildWebAppRuntimeConfig", () => {
  it("defaults to /api on the page origin and the OIDC provider the API validates", () => {
    const config = buildWebAppRuntimeConfig({
      OIDC_ISSUER_URL: "https://idp.example.org/realms/acme",
      OIDC_AUDIENCE: "platform-api",
    })
    expect(config).toEqual({
      apiUrl: "/api",
      oidcAuthority: "https://idp.example.org/realms/acme",
      oidcAudience: "platform-api",
    })
  })

  it("maps WEB_* variables and lets them override the defaults", () => {
    const config = buildWebAppRuntimeConfig({
      OIDC_ISSUER_URL: "https://idp.internal/realms/acme",
      WEB_OIDC_AUTHORITY: "https://login.example.org/realms/acme",
      WEB_OIDC_CLIENT_ID: "spa-client",
      WEB_API_URL: "https://api.example.org",
      WEB_APP_TITLE: "Acme",
      WEB_HELP_AGENT_EMBED_HINT: '{"en":"Need help?"}',
    })
    expect(config.oidcAuthority).toBe("https://login.example.org/realms/acme")
    expect(config.oidcClientId).toBe("spa-client")
    expect(config.apiUrl).toBe("https://api.example.org")
    expect(config.appTitle).toBe("Acme")
    expect(config.helpAgentEmbedHint).toBe('{"en":"Need help?"}')
  })

  it("hands the authorization parameters to the browser, the WEB_ value winning", () => {
    expect(
      buildWebAppRuntimeConfig({ OIDC_AUTHORIZATION_PARAMS: '{"organization":"org_123"}' })
        .oidcAuthorizationParams,
    ).toBe('{"organization":"org_123"}')
    expect(
      buildWebAppRuntimeConfig({
        OIDC_AUTHORIZATION_PARAMS: '{"organization":"org_123"}',
        WEB_OIDC_AUTHORIZATION_PARAMS: '{"organization":"org_web"}',
      }).oidcAuthorizationParams,
    ).toBe('{"organization":"org_web"}')
    expect(buildWebAppRuntimeConfig({}).oidcAuthorizationParams).toBeUndefined()
  })

  it("refuses malformed authorization parameters at boot", () => {
    expect(() =>
      buildWebAppRuntimeConfig({ OIDC_AUTHORIZATION_PARAMS: "organization=org_123" }),
    ).toThrow("OIDC_AUTHORIZATION_PARAMS must be a JSON object")
    expect(() =>
      buildWebAppRuntimeConfig({ OIDC_AUTHORIZATION_PARAMS: '{"max_age":300}' }),
    ).toThrow("values are strings")
  })

  it("never copies unrelated environment variables", () => {
    const config = buildWebAppRuntimeConfig({
      BULL_BOARD_OIDC_CLIENT_SECRET: "secret",
      DATABASE_URL: "x",
    })
    expect(Object.values(config)).not.toContain("secret")
    expect(Object.values(config)).not.toContain("x")
  })
})
