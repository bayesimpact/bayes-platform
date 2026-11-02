import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface"
import { buildCorsOptionsDelegate, parseFrontendUrls } from "./cors"

describe("parseFrontendUrls", () => {
  it("returns the local dev URLs when unset outside production", () => {
    expect(parseFrontendUrls(undefined, false)).toEqual([
      "https://connect.localhost:5173",
      "https://connect.localhost:5174",
    ])
  })

  it("returns the local dev URLs when blank outside production", () => {
    expect(parseFrontendUrls(" , ", false)).toEqual([
      "https://connect.localhost:5173",
      "https://connect.localhost:5174",
    ])
  })

  it("throws when unset in production", () => {
    expect(() => parseFrontendUrls(undefined, true)).toThrow(/FRONTEND_URL must be set/)
  })

  it("throws when blank in production", () => {
    expect(() => parseFrontendUrls(" , ", true)).toThrow(/FRONTEND_URL must be set/)
  })

  it("splits a comma-separated list and trims entries", () => {
    expect(parseFrontendUrls(" https://a.example , https://b.example ", true)).toEqual([
      "https://a.example",
      "https://b.example",
    ])
  })

  it("normalizes scheme-less entries to https", () => {
    expect(parseFrontendUrls("app.example,http://local.example", true)).toEqual([
      "https://app.example",
      "http://local.example",
    ])
  })
})

describe("buildCorsOptionsDelegate", () => {
  const frontendUrls = ["https://app.example"]

  const optionsFor = (url: string | undefined): CorsOptions => {
    let received: CorsOptions | undefined
    buildCorsOptionsDelegate(frontendUrls)({ url }, (error, options) => {
      expect(error).toBeNull()
      received = options as CorsOptions
    })
    if (!received) {
      throw new Error("delegate did not call back synchronously")
    }
    return received
  }

  it("reflects the origin on public embed endpoints", () => {
    expect(optionsFor("/public/agents/token123/config").origin).toBe(true)
  })

  it("pins origins to the frontend URLs everywhere else", () => {
    expect(optionsFor("/organizations/1/projects").origin).toEqual(frontendUrls)
  })

  it("pins origins when the URL is missing", () => {
    expect(optionsFor(undefined).origin).toEqual(frontendUrls)
  })

  it('does not match paths that merely start with "public"', () => {
    expect(optionsFor("/publications").origin).toEqual(frontendUrls)
  })

  it("never enables credentialed CORS", () => {
    expect(optionsFor("/public/agents/token123/config").credentials).toBeUndefined()
    expect(optionsFor("/organizations/1/projects").credentials).toBeUndefined()
  })
})
