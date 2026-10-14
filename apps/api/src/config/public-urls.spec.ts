import type { Request } from "express"
import { getApiPublicOrigin } from "./public-urls"

function requestTo(host: string, protocol = "https"): Request {
  return { protocol, get: (name: string) => (name === "host" ? host : undefined) } as Request
}

describe("getApiPublicOrigin", () => {
  it("prefers API_PUBLIC_URL, so the web host and the API host agree", () => {
    const env = { API_PUBLIC_URL: "https://api.platform.example.org/" }

    expect(getApiPublicOrigin(requestTo("platform.example.org"), env)).toBe(
      "https://api.platform.example.org",
    )
    expect(getApiPublicOrigin(requestTo("api.platform.example.org"), env)).toBe(
      "https://api.platform.example.org",
    )
  })

  it("falls back to the request's origin when it is not set", () => {
    expect(getApiPublicOrigin(requestTo("app.localhost:8800", "http"), {})).toBe(
      "http://app.localhost:8800",
    )
  })
})
