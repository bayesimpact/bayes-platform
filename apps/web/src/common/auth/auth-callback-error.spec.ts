import { describe, expect, it } from "vitest"
import { getAuthCallbackError, isLostSigninState } from "./auth-callback-error"

describe("getAuthCallbackError", () => {
  it("returns null when the query string carries no error", () => {
    expect(getAuthCallbackError("")).toBeNull()
    expect(getAuthCallbackError("?code=abc&state=xyz")).toBeNull()
  })

  it("reads the error code and its description", () => {
    const search =
      "?error=unauthorized_client&error_description=Client%20is%20not%20allowed%20to%20sign%20in&state=abc"
    expect(getAuthCallbackError(search)).toEqual({
      code: "unauthorized_client",
      description: "Client is not allowed to sign in",
    })
  })

  it("keeps a null description when the provider sends none", () => {
    expect(getAuthCallbackError("?error=access_denied")).toEqual({
      code: "access_denied",
      description: null,
    })
  })
})

describe("isLostSigninState", () => {
  it("detects the state the OIDC client no longer has", () => {
    expect(
      isLostSigninState({ code: "Error", description: "No matching state found in storage" }),
    ).toBe(true)
  })

  it("ignores the other errors", () => {
    expect(isLostSigninState({ code: "access_denied", description: null })).toBe(false)
    expect(isLostSigninState({ code: "Error", description: "Network Error" })).toBe(false)
  })
})
