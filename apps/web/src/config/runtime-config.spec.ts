import { describe, expect, it } from "vitest"
import {
  getAppPathname,
  mergeRuntimeConfig,
  type RuntimeConfig,
  resolveApiUrl,
  toAppHref,
} from "./runtime-config"

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

describe("toAppHref", () => {
  it("keeps the path as is when the app is served from the root", () => {
    expect(toAppHref("/studio/o/1", "/")).toBe("/studio/o/1")
  })

  it("prefixes the path with the base path, without doubling the slash", () => {
    expect(toAppHref("/studio/o/1", "/app/")).toBe("/app/studio/o/1")
    expect(toAppHref("/studio/o/1", "/app")).toBe("/app/studio/o/1")
  })
})

describe("getAppPathname", () => {
  it("returns the pathname untouched when the app is served from the root", () => {
    expect(getAppPathname("/app/o/1", "/")).toBe("/app/o/1")
  })

  it("strips the base path", () => {
    expect(getAppPathname("/app/studio/o/1", "/app/")).toBe("/studio/o/1")
    expect(getAppPathname("/app", "/app/")).toBe("/")
    expect(getAppPathname("/app/", "/app/")).toBe("/")
  })

  it("does not strip a segment that only shares the base path as a prefix", () => {
    expect(getAppPathname("/application/x", "/app/")).toBe("/application/x")
  })

  it("distinguishes the base path from a route of the same name", () => {
    expect(getAppPathname("/app/app/o/1", "/app/")).toBe("/app/o/1")
  })
})

describe("resolveApiUrl", () => {
  const origin = "https://platform.example.org"

  it("resolves the default /api against the page origin", () => {
    expect(resolveApiUrl("/api", origin)).toBe("https://platform.example.org/api")
  })

  it("treats an empty value as the default", () => {
    expect(resolveApiUrl("", origin)).toBe("https://platform.example.org/api")
  })

  it("keeps an absolute URL, without a trailing slash", () => {
    expect(resolveApiUrl("https://api.example.org/api/", origin)).toBe(
      "https://api.example.org/api",
    )
  })
})
