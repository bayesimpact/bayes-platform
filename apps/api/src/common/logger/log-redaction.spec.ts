import { redactCredentials, redactUrl } from "./log-redaction"

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

describe("redactUrl", () => {
  it("hides the message of the public chat v1 GET stream", () => {
    expect(
      redactUrl(
        "/public/v1/agents/token-1/sessions/session-1/messages/stream?q=%7B%22payload%22%7D",
      ),
    ).toBe("/public/v1/agents/token-1/sessions/session-1/messages/stream?q=[redacted]")
  })

  it("hides credentials and keeps the other parameters", () => {
    expect(redactUrl("/oauth/callback?code=one-time-code&state=abc")).toBe(
      "/oauth/callback?code=[redacted]&state=abc",
    )
  })

  it("leaves a URL without a query string as it is", () => {
    expect(redactUrl("/api/agents")).toBe("/api/agents")
  })
})
