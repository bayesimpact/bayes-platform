import { describe, expect, it } from "vitest"
import { mergeRuntimeConfig, type RuntimeConfig } from "./runtime-config"

const buildTime: RuntimeConfig = {
  apiUrl: "https://api.build",
  appTitle: "Build title",
  auth0Domain: "build.auth0.com",
  auth0ClientId: "build-client",
  auth0Audience: "https://build/api",
  auth0OrganizationId: "org_build",
}

describe("mergeRuntimeConfig", () => {
  it("returns the build-time values when nothing is injected", () => {
    expect(mergeRuntimeConfig(buildTime, undefined)).toEqual(buildTime)
  })

  it("lets the injected values win, key by key", () => {
    const merged = mergeRuntimeConfig(buildTime, { apiUrl: "", auth0ClientId: "runtime-client" })
    expect(merged.apiUrl).toBe("")
    expect(merged.auth0ClientId).toBe("runtime-client")
    expect(merged.appTitle).toBe("Build title")
  })

  it("ignores undefined and null injected values", () => {
    const injected = {
      appTitle: undefined,
      helpCenterUrl: null,
    } as unknown as Partial<RuntimeConfig>
    expect(mergeRuntimeConfig(buildTime, injected).appTitle).toBe("Build title")
    expect(mergeRuntimeConfig(buildTime, injected).helpCenterUrl).toBeUndefined()
  })
})
