import { describe, expect, it } from "vitest"
import { signInCallbackProblemOf, signInCallbackSearchSchema } from "./sign-in-problems"

describe("signInCallbackProblemOf", () => {
  it("tells a lost sign-in state from a refusal", () => {
    expect(signInCallbackProblemOf(new Error("No matching state found in storage"), {})).toEqual({
      problem: "lostState",
    })
  })

  it("keeps the provider's own words on a refusal, else the error's", () => {
    const search = signInCallbackSearchSchema.parse({
      error: "access_denied",
      error_description: "The user cancelled the sign-in",
      state: "abc",
    })

    expect(signInCallbackProblemOf(new Error("access_denied"), search)).toEqual({
      problem: "providerRefused",
      detail: "The user cancelled the sign-in",
    })
    expect(signInCallbackProblemOf(new Error("Network down"), {})).toEqual({
      problem: "providerRefused",
      detail: "Network down",
    })
  })
})
