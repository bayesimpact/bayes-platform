import type { SignInRefusal } from "@caseai-connect/desk-contracts"
import { z } from "zod"

/** Why the person cannot get in: a refusal of the API, a loop, a lost or a refused sign-in. */
export type SignInProblem = SignInRefusal | "loop" | "lostState" | "providerRefused"

/**
 * The API refused the person's first sign-in, and would refuse a new one the same way: the Desk
 * explains why instead of sending them back to the provider.
 */
export class SignInRefusedError extends Error {
  readonly refusal: SignInRefusal

  constructor(refusal: SignInRefusal) {
    super(`The API refused the sign-in: ${refusal}`)
    this.name = "SignInRefusedError"
    this.refusal = refusal
  }
}

/** New sign-ins keep ending without a working session: the Desk stops starting them. */
export class SignInLoopError extends Error {
  constructor() {
    super("The sign-in keeps failing: no new one starts on its own.")
    this.name = "SignInLoopError"
  }
}

const AUTOMATIC_SIGN_IN_KEY = "desk.automaticSignInAt"
const LOST_STATE_RETRY_KEY = "desk.lostStateRetryAt"

/** A new sign-in the Desk starts on its own, at most this often. */
const AUTOMATIC_SIGN_IN_WINDOW_IN_MILLISECONDS = 30 * 1000
/** A lost sign-in state is tried again on its own at most this often. */
const LOST_STATE_RETRY_WINDOW_IN_MILLISECONDS = 60 * 1000

/** True when nothing claimed `key` in the last `windowInMilliseconds`, which it then claims. */
function claimOnce(key: string, windowInMilliseconds: number): boolean {
  try {
    const lastClaimedAt = Number(window.sessionStorage.getItem(key))
    if (Date.now() - lastClaimedAt < windowInMilliseconds) return false
    window.sessionStorage.setItem(key, String(Date.now()))
    return true
  } catch {
    // No session storage: the Desk cannot tell a loop, and stops rather than risk one.
    return false
  }
}

/**
 * Whether the Desk may start a new sign-in on its own now: once per 30 s at most, so a session
 * that ends at once, again and again, cannot send the person to the provider in a loop.
 */
export function claimAutomaticSignIn(): boolean {
  return claimOnce(AUTOMATIC_SIGN_IN_KEY, AUTOMATIC_SIGN_IN_WINDOW_IN_MILLISECONDS)
}

/** Whether a lost sign-in state may be tried again on its own now: once a minute at most. */
export function claimLostStateRetry(): boolean {
  return claimOnce(LOST_STATE_RETRY_KEY, LOST_STATE_RETRY_WINDOW_IN_MILLISECONDS)
}

/**
 * What the provider's return says when it refuses, in the query of the callback (RFC 6749,
 * section 4.1.2.1). A value that does not fit is left out.
 */
export const signInCallbackSearchSchema = z.object({
  error: z.string().optional().catch(undefined),
  error_description: z.string().optional().catch(undefined),
})

export type SignInCallbackSearch = z.output<typeof signInCallbackSearchSchema>

/** The words of oidc-client-ts when the state of the sign-in the provider returned from is gone. */
const LOST_STATE_MESSAGE = "No matching state found in storage"

/**
 * Whether completing a sign-in failed because this tab lost its state: its storage was cleared,
 * or another tab started a new sign-in. A new sign-in fixes it, unlike a refusal.
 */
function isLostStateError(error: unknown): boolean {
  return error instanceof Error && error.message.includes(LOST_STATE_MESSAGE)
}

/** Why completing a sign-in failed, with the provider's words when it refused. */
export type SignInCallbackProblem =
  | { problem: "lostState" }
  | { problem: "providerRefused"; detail: string }

/**
 * Why completing a sign-in failed: this tab lost its state, which a new sign-in fixes, or the
 * provider refused, in its own words for support, else in the error's.
 */
export function signInCallbackProblemOf(
  error: unknown,
  search: SignInCallbackSearch,
): SignInCallbackProblem {
  if (isLostStateError(error)) return { problem: "lostState" }
  const detail =
    search.error_description ??
    search.error ??
    (error instanceof Error ? error.message : String(error))
  return { problem: "providerRefused", detail }
}

/** Lets the Desk start a new sign-in at once, when the person asks for one themselves. */
export function releaseAutomaticSignIn(): void {
  try {
    window.sessionStorage.removeItem(AUTOMATIC_SIGN_IN_KEY)
  } catch {
    // No session storage: nothing was kept.
  }
}
