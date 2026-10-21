import type { SignInRefusal } from "@caseai-connect/desk-contracts"

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

/** Lets the Desk start a new sign-in at once, when the person asks for one themselves. */
export function releaseAutomaticSignIn(): void {
  try {
    window.sessionStorage.removeItem(AUTOMATIC_SIGN_IN_KEY)
  } catch {
    // No session storage: nothing was kept.
  }
}
