import { describe, expect, it } from "vitest"
import { SIGN_IN_REFUSALS, signInRefusalOf } from "./sign-in-refusals"

describe("signInRefusalOf", () => {
  it("names each refusal the API sends", () => {
    for (const [message, refusal] of Object.entries(SIGN_IN_REFUSALS)) {
      expect(signInRefusalOf(message)).toBe(refusal)
    }
  })

  it("names none for another message, a key every object inherits, or no text", () => {
    expect(signInRefusalOf("Unauthorized")).toBeNull()
    expect(signInRefusalOf("constructor")).toBeNull()
    expect(signInRefusalOf(undefined)).toBeNull()
  })
})
