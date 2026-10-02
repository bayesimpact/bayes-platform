import { describe, expect, it } from "vitest"
import { buildInvitationLink, readLoginHint } from "./login-hint"

describe("buildInvitationLink", () => {
  it("encodes the email, including a plus sign", () => {
    expect(buildInvitationLink("first.last+team@example.com", "https://app.example.com")).toBe(
      "https://app.example.com/?login_hint=first.last%2Bteam%40example.com",
    )
  })
})

describe("readLoginHint", () => {
  it("reads back the email of an invitation link", () => {
    const link = buildInvitationLink("first.last+team@example.com", "https://app.example.com")
    expect(readLoginHint(new URL(link).search)).toBe("first.last+team@example.com")
  })

  it("returns undefined without a hint", () => {
    expect(readLoginHint("")).toBeUndefined()
    expect(readLoginHint("?login_hint=%20")).toBeUndefined()
  })
})
