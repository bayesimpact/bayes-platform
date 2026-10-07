import { ErrorResponse, type User, UserManager } from "oidc-client-ts"
import { getOidcSettings } from "@/config/oidc.config"
import { getAppPathname, getAppUrl } from "@/config/runtime-config"

/**
 * Single OIDC client for the whole app: the React provider (main.tsx) and the
 * non-React callers (axios interceptor, SSE streams) share its session.
 */
let userManagerInstance: UserManager | null = null

export function getUserManager(): UserManager {
  if (!userManagerInstance) {
    userManagerInstance = new UserManager(getOidcSettings())
    userManagerInstance.events.addAccessTokenExpiring(renewBeforeExpiry)
  }
  return userManagerInstance
}

/** The session is gone (no user, or the refresh failed): the user must sign in again. */
export class AuthenticationRequiredError extends Error {
  constructor(
    message: string,
    public readonly originalError?: unknown,
  ) {
    super(message)
    this.name = "AuthenticationRequiredError"
  }
}

/**
 * Returns a valid access token, refreshing it when it has expired.
 *
 * @throws {AuthenticationRequiredError} when there is no session or the provider refuses to refresh it
 */
export async function getAccessToken(): Promise<string> {
  const user = await getUserManager().getUser()
  if (!user) throw new AuthenticationRequiredError("No session. The user needs to sign in.")
  if (!user.expired && user.access_token) return user.access_token
  return refreshSession()
}

/**
 * Every refresh goes through here, the background renewal included. With
 * refresh token rotation, two refreshes in parallel send the same refresh
 * token twice: the second one fails with invalid_grant, and some providers
 * then revoke the whole token family. `tokenRefreshPromise` shares one
 * refresh between the callers of this tab, the Web Lock between the tabs.
 */
let tokenRefreshPromise: Promise<string> | null = null

const REFRESH_LOCK_NAME = "oidc-token-refresh"

function refreshSession(): Promise<string> {
  if (!tokenRefreshPromise) {
    tokenRefreshPromise = withRefreshLock(refreshUnderLock).finally(() => {
      tokenRefreshPromise = null
    })
  }
  return tokenRefreshPromise
}

async function withRefreshLock(task: () => Promise<string>): Promise<string> {
  if (typeof navigator === "undefined" || !navigator.locks) return task()
  return await navigator.locks.request(REFRESH_LOCK_NAME, task)
}

async function refreshUnderLock(): Promise<string> {
  const userManager = getUserManager()
  // Another tab may have refreshed while this one waited for the lock: the
  // shared storage then holds a fresh token. Raising the event keeps the
  // React state of this tab in sync.
  const user = await userManager.getUser(true)
  if (!user) throw new AuthenticationRequiredError("No session. The user needs to sign in.")
  const renewalMargin = userManager.settings.accessTokenExpiringNotificationTimeInSeconds
  if (user.access_token && user.expires_in !== undefined && user.expires_in > renewalMargin) {
    return user.access_token
  }

  try {
    const refreshedUser = await userManager.signinSilent()
    if (!refreshedUser?.access_token) {
      throw new AuthenticationRequiredError("The provider returned no access token.")
    }
    return refreshedUser.access_token
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) throw error
    // Only a refusal from the provider (invalid_grant: refresh token expired
    // or revoked) ends the session. A network failure is transient and must
    // not log the user out.
    if (!(error instanceof ErrorResponse)) throw error
    throw new AuthenticationRequiredError(
      "The session could not be refreshed. The user needs to sign in again.",
      error,
    )
  }
}

/**
 * Reading the stored user re-arms the client's expiring timer, at 1s once the
 * token is inside the renewal margin. Without a pause, a failed renewal (the
 * provider is unreachable) would retry every second until the token expires.
 * API calls are not paused: they refresh on their own when the token expired.
 */
const RENEWAL_RETRY_DELAY_MS = 15_000
let nextRenewalAttemptAt = 0

/**
 * Renews the token shortly before it expires, in place of the client's
 * `automaticSilentRenew` which would bypass the lock above. A failure is only
 * logged: the next API call retries, and logs the user out if the session is gone.
 */
function renewBeforeExpiry(): void {
  if (Date.now() < nextRenewalAttemptAt) return
  refreshSession().catch((error: unknown) => {
    nextRenewalAttemptAt = Date.now() + RENEWAL_RETRY_DELAY_MS
    console.warn("Background token renewal failed:", error)
  })
}

/**
 * `loginHint` pre-fills the email on the provider's screens (OIDC `login_hint`).
 * The provider always comes back to the app root: the current page travels in
 * the OIDC `state` so the home route can return to it.
 */
export async function login({ loginHint }: { loginHint?: string } = {}): Promise<void> {
  const returnTo = getCurrentAppPath()
  await getUserManager().signinRedirect({
    ...(loginHint ? { login_hint: loginHint } : {}),
    ...(returnTo ? { state: { returnTo } satisfies SigninState } : {}),
  })
}

type SigninState = { returnTo: string }

function getCurrentAppPath(): string | null {
  const pathname = getAppPathname()
  if (pathname === "/") return null
  return `${pathname}${window.location.search}${window.location.hash}`
}

let signinReturnTo: string | null = null

/** Called once the provider sent the user back: keeps the page to return to. */
export function rememberSigninReturnTo(user: User | undefined): void {
  const state = user?.state
  const returnTo =
    typeof state === "object" && state !== null && "returnTo" in state ? state.returnTo : null
  // A relative path only, never another origin (`//host`)
  signinReturnTo =
    typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : null
}

/** The page the user was on before the sign-in, once. */
export function takeSigninReturnTo(): string | null {
  const returnTo = signinReturnTo
  signinReturnTo = null
  return returnTo
}

/**
 * Ends the session at the provider when it supports RP-initiated logout
 * (`end_session_endpoint`), otherwise only locally, then returns to the app.
 */
export async function logout(): Promise<void> {
  const userManager = getUserManager()
  const user = await userManager.getUser()
  try {
    await userManager.signoutRedirect({ id_token_hint: user?.id_token })
  } catch {
    await userManager.removeUser()
    window.location.assign(getAppUrl())
  }
}
