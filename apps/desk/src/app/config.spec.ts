import { afterEach, describe, expect, it, vi } from "vitest"

/** The configuration the Desk reads at startup, with this injected one and these build values. */
async function readConfigWith({
  injected,
  build = {},
}: {
  injected?: Record<string, string | undefined>
  build?: Record<string, string>
}) {
  vi.stubGlobal("window", { __CONFIG__: injected })
  for (const [name, value] of Object.entries(build)) vi.stubEnv(name, value)
  // The configuration is read once, when its module loads: each test loads it afresh.
  vi.resetModules()
  const { appConfig } = await import("./config")
  return appConfig
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("the Desk's configuration", () => {
  it("takes the build's values when the API injects none", async () => {
    // The build's values are those of the tests, in vite.config.ts.
    const config = await readConfigWith({})

    expect(config).toEqual({
      mode: "api",
      oidcAuthority: "https://idp.example.org",
      oidcClientId: "desk-tests",
      oidcAudience: undefined,
      oidcScope: undefined,
      oidcAuthorizationParams: {},
    })
  })

  it("prefers what the API injects to the build's values, value by value", async () => {
    const config = await readConfigWith({
      injected: { oidcClientId: "desk-install", oidcScope: undefined },
      build: { VITE_OIDC_SCOPE: "openid email" },
    })

    expect(config).toMatchObject({
      oidcAuthority: "https://idp.example.org",
      oidcClientId: "desk-install",
      oidcScope: "openid email",
    })
  })

  it("reads a blank value as no value", async () => {
    const config = await readConfigWith({
      injected: { oidcAudience: "   " },
      build: { VITE_OIDC_SCOPE: "" },
    })

    expect(config).toMatchObject({ oidcAudience: undefined, oidcScope: undefined })
  })

  it("reads the extra authorize parameters as a JSON object", async () => {
    const config = await readConfigWith({
      injected: { oidcAuthorizationParams: '{"organization":"org_123"}' },
    })

    expect(config).toMatchObject({ oidcAuthorizationParams: { organization: "org_123" } })
  })

  it("refuses to start on an invalid configuration, and says what is wrong", async () => {
    await expect(readConfigWith({ injected: { oidcAuthority: "not a URL" } })).rejects.toThrow(
      /The Desk's configuration is invalid[\s\S]*oidcAuthority/,
    )
    await expect(
      readConfigWith({ injected: { oidcAuthorizationParams: "organization=org_123" } }),
    ).rejects.toThrow(/must be a JSON object of strings/)
  })
})
