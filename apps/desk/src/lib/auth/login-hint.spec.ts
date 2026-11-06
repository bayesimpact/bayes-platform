import { describe, expect, it } from "vitest"
import { readLoginHint } from "./login-hint"

describe("readLoginHint", () => {
  it("reads the email of an agent invitation's link, including a plus sign", () => {
    expect(readLoginHint("?login_hint=first.last%2Bteam%40example.com")).toBe(
      "first.last+team@example.com",
    )
  })

  it("returns undefined without a hint", () => {
    expect(readLoginHint("")).toBeUndefined()
    expect(readLoginHint("?login_hint=%20")).toBeUndefined()
  })
})
