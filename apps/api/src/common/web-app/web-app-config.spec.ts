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
  it("defaults to /api on the page origin and the Auth0 tenant the API validates", () => {
    const config = buildWebAppRuntimeConfig({
      AUTH0_ISSUER_URL: "https://tenant.eu.auth0.com/",
      AUTH0_AUDIENCE: "https://tenant.eu.auth0.com/api/v2/",
      AUTH0_ORGANIZATION_ID: "org_123",
    })
    expect(config).toEqual({
      apiUrl: "/api",
      auth0Domain: "tenant.eu.auth0.com",
      auth0Audience: "https://tenant.eu.auth0.com/api/v2/",
      auth0OrganizationId: "org_123",
    })
  })

  it("maps WEB_* variables and lets them override the defaults", () => {
    const config = buildWebAppRuntimeConfig({
      AUTH0_ISSUER_URL: "https://tenant.eu.auth0.com/",
      WEB_AUTH0_DOMAIN: "login.example.org",
      WEB_AUTH0_CLIENT_ID: "spa-client",
      WEB_API_URL: "https://api.example.org",
      WEB_APP_TITLE: "Acme",
      WEB_HELP_AGENT_EMBED_HINT: '{"en":"Need help?"}',
    })
    expect(config.auth0Domain).toBe("login.example.org")
    expect(config.auth0ClientId).toBe("spa-client")
    expect(config.apiUrl).toBe("https://api.example.org")
    expect(config.appTitle).toBe("Acme")
    expect(config.helpAgentEmbedHint).toBe('{"en":"Need help?"}')
  })

  it("never copies unrelated environment variables", () => {
    const config = buildWebAppRuntimeConfig({ AUTH0_CLIENT_SECRET: "secret", DATABASE_URL: "x" })
    expect(Object.values(config)).not.toContain("secret")
    expect(Object.values(config)).not.toContain("x")
  })
})
