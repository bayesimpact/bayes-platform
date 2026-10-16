import { redactCredentials } from "./request-logger.middleware"

describe("redactCredentials", () => {
  it("hides OAuth credentials and keeps the rest", () => {
    expect(
      redactCredentials({
        grant_type: "refresh_token",
        refresh_token: "secret-refresh",
        client_id: "dcr_abc",
      }),
    ).toEqual({ grant_type: "refresh_token", refresh_token: "[redacted]", client_id: "dcr_abc" })
  })

  it("looks into nested payloads and lists", () => {
    expect(
      redactCredentials({
        payload: { items: [{ code: "one-time-code", name: "Helpful Assistant" }] },
      }),
    ).toEqual({ payload: { items: [{ code: "[redacted]", name: "Helpful Assistant" }] } })
  })
})
