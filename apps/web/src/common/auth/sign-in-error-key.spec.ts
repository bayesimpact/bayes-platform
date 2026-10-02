import { SIGN_IN_ERRORS } from "@caseai-connect/api-contracts"
import { describe, expect, it } from "vitest"
import { signInErrorKey } from "./sign-in-error-key"

describe("signInErrorKey", () => {
  it("recognizes each sign-in refusal of the API", () => {
    expect(signInErrorKey(SIGN_IN_ERRORS.EMAIL_NOT_VERIFIED)).toBe("emailNotVerified")
    expect(signInErrorKey(SIGN_IN_ERRORS.EMAIL_REQUIRED)).toBe("emailRequired")
    expect(signInErrorKey(SIGN_IN_ERRORS.EMAIL_LINKING_DISABLED)).toBe("emailLinkingDisabled")
  })

  it("leaves other errors to the generic message", () => {
    expect(signInErrorKey("access_denied")).toBeUndefined()
    expect(signInErrorKey(undefined)).toBeUndefined()
  })
})
