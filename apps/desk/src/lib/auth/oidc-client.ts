import { ErrorResponse, type User, UserManager } from "oidc-client-ts"
import { appBasePath, appConfig } from "@/app/config"
import { buildOidcSettings, OIDC_STORE_PREFIX } from "./oidc-settings"

/**
 * The Desk's sign-in on the install's identity provider: one OIDC client, which signs the person
 * in and out, completes the provider's return, renews the token before it expires, refreshes it
 * once under a lock shared by the tabs, and follows the sign-out of another tab.
 */

/** The Desk's root URL on this origin, with its trailing slash: `https://host/app/`. */
function getAppUrl(): string {
  return `${window.location.origin}${appBasePath}`
}

/** One OIDC client for the whole Desk: the routes and the API client share its session. */
let userManagerInstance: UserManager | null = null

function getUserManager(): UserManager {
  if (!userManagerInstance) {
    if (appConfig.mode !== "api") throw new Error("The mock mode has no sign-in")
    userManagerInstance = new UserManager(buildOidcSettings(appConfig, getAppUrl()))
    userManagerInstance.events.addAccessTokenExpiring(renewBeforeExpiry)
    watchOtherTabs(userManagerInstance)
  }
  return userManagerInstance
}

/** The session is gone (no user, or the refresh failed): the person must sign in again. */
export class AuthenticationRequiredError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "AuthenticationRequiredError"
  }
}

/** Whether a session exists, or can be renewed with its refresh token. */
export async function hasSession(): Promise<boolean> {
  if (isSigningOut) return untilThePageLeaves()
  const user = await getUserManager().getUser()
  return Boolean(user && (!user.expired || user.refresh_token))
}

/**
 * Returns a valid access token, refreshing it when it has expired, or always with `forceRefresh`.
 *
 * @throws {AuthenticationRequiredError} when there is no session or the provider refuses to refresh it
 */
export async function getAccessToken({ forceRefresh = false } = {}): Promise<string> {
  if (isSigningOut) return untilThePageLeaves()
  const user = await getUserManager().getUser()
  if (!user) throw new AuthenticationRequiredError("No session. The person needs to sign in.")
  if (!forceRefresh && !user.expired && user.access_token) return user.access_token
  return refreshSession({ forceRefresh })
}

/**
 * Every refresh goes through here, the background renewal included. With refresh token rotation,
 * two refreshes in parallel send the same refresh token twice: the second one fails with
 * invalid_grant, and some providers then revoke the whole token family. `tokenRefresh` shares
 * one refresh between the callers of this tab, the Web Lock between the Desk's tabs. A forced
 * refresh never joins a plain one, which may keep the stored token the API just refused: it runs
 * after it instead.
 */
let tokenRefresh: { promise: Promise<string>; isForced: boolean } | null = null

const REFRESH_LOCK_NAME = "desk-oidc-token-refresh"

function refreshSession({ forceRefresh }: { forceRefresh: boolean }): Promise<string> {
  if (tokenRefresh && (tokenRefresh.isForced || !forceRefresh)) return tokenRefresh.promise
  const previous = tokenRefresh?.promise.catch(() => undefined) ?? Promise.resolve()
  const refresh = previous.then(() => withRefreshLock(() => refreshUnderLock({ forceRefresh })))
  const current = {
    promise: refresh.finally(() => {
      if (tokenRefresh === current) tokenRefresh = null
    }),
    isForced: forceRefresh,
  }
  tokenRefresh = current
  return current.promise
}

async function withRefreshLock(task: () => Promise<string>): Promise<string> {
  if (typeof navigator === "undefined" || !navigator.locks) return task()
  return await navigator.locks.request(REFRESH_LOCK_NAME, task)
}

async function refreshUnderLock({ forceRefresh }: { forceRefresh: boolean }): Promise<string> {
  const userManager = getUserManager()
  // Another tab may have refreshed while this one waited for the lock: the shared storage then
  // holds a fresh token.
  const user = await userManager.getUser(true)
  if (!user) throw new AuthenticationRequiredError("No session. The person needs to sign in.")
  const renewalMargin = userManager.settings.accessTokenExpiringNotificationTimeInSeconds
  if (
    !forceRefresh &&
    user.access_token &&
    user.expires_in !== undefined &&
    user.expires_in > renewalMargin
  ) {
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
    // Only a refusal from the provider (invalid_grant: refresh token expired or revoked) ends the
    // session. A network failure is transient and must not sign the person out.
    if (!(error instanceof ErrorResponse)) throw error
    throw new AuthenticationRequiredError(
      "The session could not be refreshed. The person needs to sign in again.",
      { cause: error },
    )
  }
}

/**
 * Reading the stored user re-arms the client's expiring timer, at 1 s once the token is inside the
 * renewal margin. Without a pause, a failed renewal (the provider is unreachable) would retry every
 * second until the token expires. API calls are not paused: they refresh on their own.
 */
const RENEWAL_RETRY_DELAY_MS = 15_000
let nextRenewalAttemptAt = 0

/**
 * Renews the token shortly before it expires, in place of the client's `automaticSilentRenew`,
 * which would bypass the lock above. A failure is only reported: the next API call retries, and
 * starts a new sign-in if the session is gone.
 */
function renewBeforeExpiry(): void {
  if (Date.now() < nextRenewalAttemptAt) return
  refreshSession({ forceRefresh: false }).catch((error: unknown) => {
    nextRenewalAttemptAt = Date.now() + RENEWAL_RETRY_DELAY_MS
    console.error("Background token renewal failed:", error)
  })
}

type SigninState = { returnTo: string }

/**
 * Sends the person to the provider. `returnTo` is the Desk page to open afterwards, as a path of
 * this origin (`/app/...`): it travels in the OIDC state. `loginHint` pre-fills the email on the
 * provider's screens.
 */
export async function signIn({
  returnTo,
  loginHint,
}: {
  returnTo: string
  loginHint?: string
}): Promise<void> {
  keepTabReturnTo(returnTo)
  await getUserManager().signinRedirect({
    state: { returnTo } satisfies SigninState,
    ...(loginHint ? { login_hint: loginHint } : {}),
  })
}

/** Completes the sign-in the provider sent the person back from, and returns the page to open. */
export async function completeSignIn(): Promise<string> {
  const user = await getUserManager().signinRedirectCallback()
  keepTabReturnTo(null)
  return readReturnTo(user) ?? appBasePath
}

function readReturnTo(user: User): string | null {
  const state = user.state
  const returnTo =
    typeof state === "object" && state !== null && "returnTo" in state ? state.returnTo : null
  return safeReturnTo(returnTo)
}

/** A path of the Desk on this origin only, never another origin (`//host`) or another app. */
function safeReturnTo(returnTo: unknown): string | null {
  return typeof returnTo === "string" &&
    returnTo.startsWith(appBasePath) &&
    !returnTo.startsWith("//")
    ? returnTo
    : null
}

/**
 * The OIDC state can be lost (a cleared storage, a sign-in started in another tab), and the page
 * to return to with it. This tab keeps a copy in its session storage, which only this tab changes.
 */
const TAB_RETURN_TO_KEY = `${OIDC_STORE_PREFIX}signin-return-to`

function keepTabReturnTo(returnTo: string | null): void {
  try {
    if (returnTo) window.sessionStorage.setItem(TAB_RETURN_TO_KEY, returnTo)
    else window.sessionStorage.removeItem(TAB_RETURN_TO_KEY)
  } catch {
    // No session storage: a lost sign-in state then returns to the Desk's home.
  }
}

/** The page this tab was on when its last sign-in started, once. */
export function takeTabReturnTo(): string | null {
  try {
    const returnTo = window.sessionStorage.getItem(TAB_RETURN_TO_KEY)
    window.sessionStorage.removeItem(TAB_RETURN_TO_KEY)
    return safeReturnTo(returnTo)
  } catch {
    return null
  }
}

const sessionEndedListeners = new Set<() => void>()

/** Calls `listener` when the session ends: sign-out, a failed refresh or another tab's sign-out. */
export function onSessionEnded(listener: () => void): () => void {
  sessionEndedListeners.add(listener)
  return () => sessionEndedListeners.delete(listener)
}

function notifySessionEnded(): void {
  for (const listener of sessionEndedListeners) listener()
}

/** Forgets a session the provider refused to refresh. */
export async function endSession(): Promise<void> {
  await getUserManager().removeUser()
  notifySessionEnded()
}

/** Another Desk tab that signs out, or loses its session, removes the stored user: so does this one. */
function watchOtherTabs(userManager: UserManager): void {
  const userKey = `${OIDC_STORE_PREFIX}user:${userManager.settings.authority}:${userManager.settings.client_id}`
  window.addEventListener("storage", (event) => {
    if (event.key === userKey && event.newValue === null) notifySessionEnded()
  })
}

/**
 * Whether the person is signing out: the page leaves for the provider, or reloads, at once. Until
 * it does, nothing reads the session, or the page would see none and start a new sign-in, which
 * the Desk would take for a loop once the person comes back.
 */
let isSigningOut = false

/** A promise that never settles: what waits on it ends with the page. */
function untilThePageLeaves(): Promise<never> {
  return new Promise<never>(() => {})
}

/**
 * Ends the session at the provider when it supports RP-initiated logout (`end_session_endpoint`),
 * otherwise only in the Desk, then returns to the Desk's home. The page leaves at once, so it
 * neither clears its data nor reloads its pages: another tab learns of it from the storage.
 */
export async function signOut(): Promise<void> {
  isSigningOut = true
  const userManager = getUserManager()
  const user = await userManager.getUser()
  try {
    await userManager.signoutRedirect({ id_token_hint: user?.id_token })
  } catch {
    await userManager.removeUser()
    window.location.assign(getAppUrl())
  }
}
