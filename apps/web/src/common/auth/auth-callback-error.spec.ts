import { describe, expect, it } from "vitest"
import { getAuthCallbackError } from "./auth-callback-error"

describe("getAuthCallbackError", () => {
  it("returns null when the query string carries no error", () => {
    expect(getAuthCallbackError("")).toBeNull()
    expect(getAuthCallbackError("?code=abc&state=xyz")).toBeNull()
  })

  it("reads the error code and its description", () => {
    const search =
      "?error=invalid_request&error_description=parameter%20organization%20is%20not%20allowed%20for%20this%20client&state=abc"
    expect(getAuthCallbackError(search)).toEqual({
      code: "invalid_request",
      description: "parameter organization is not allowed for this client",
    })
  })

  it("keeps a null description when Auth0 sends none", () => {
    expect(getAuthCallbackError("?error=access_denied")).toEqual({
      code: "access_denied",
      description: null,
    })
  })
})
