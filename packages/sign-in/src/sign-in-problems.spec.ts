import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  createSignInGuards,
  signInCallbackProblemOf,
  signInCallbackSearchSchema,
} from "./sign-in-problems"

describe("createSignInGuards", () => {
  beforeEach(() => {
    const storage = new Map<string, string>()
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("lets each app start one sign-in on its own, then waits", () => {
    const desk = createSignInGuards("desk")
    const evaluation = createSignInGuards("eval")

    expect(desk.claimAutomaticSignIn()).toBe(true)
    expect(evaluation.claimAutomaticSignIn()).toBe(true)
    expect(desk.claimAutomaticSignIn()).toBe(false)
    expect(evaluation.claimAutomaticSignIn()).toBe(false)
  })

  it("frees only its own app when the person asks for a sign-in", () => {
    const desk = createSignInGuards("desk")
    const evaluation = createSignInGuards("eval")
    desk.claimAutomaticSignIn()
    evaluation.claimAutomaticSignIn()

    desk.releaseAutomaticSignIn()

    expect(desk.claimAutomaticSignIn()).toBe(true)
    expect(evaluation.claimAutomaticSignIn()).toBe(false)
  })

  it("retries a lost sign-in state once a minute at most", () => {
    const desk = createSignInGuards("desk")
    expect(desk.claimLostStateRetry()).toBe(true)
    expect(desk.claimLostStateRetry()).toBe(false)
  })
})

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
