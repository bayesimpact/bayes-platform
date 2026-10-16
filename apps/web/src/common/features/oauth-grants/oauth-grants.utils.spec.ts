import { describe, expect, it } from "vitest"
import { oauthGrantClientFactory } from "./oauth-grants.factory"
import { oauthGrantClientLabel } from "./oauth-grants.utils"

describe("oauthGrantClientLabel", () => {
  it("prefers the declared name", () => {
    const client = oauthGrantClientFactory.build({ name: "Helpful Assistant" })
    expect(oauthGrantClientLabel(client)).toBe("Helpful Assistant")
  })

  it("falls back to the host of a metadata document client id", () => {
    const client = oauthGrantClientFactory.build({
      name: null,
      clientId: "https://app.example.com/oauth/client.json",
    })
    expect(oauthGrantClientLabel(client)).toBe("app.example.com")
  })

  it("returns null for an opaque client id without a name", () => {
    const client = oauthGrantClientFactory.build({ name: null, clientId: "3f0c9a52-client" })
    expect(oauthGrantClientLabel(client)).toBeNull()
  })
})
