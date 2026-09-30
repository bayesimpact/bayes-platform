import { UserManager } from "oidc-client-ts"
import { getOidcSettings } from "@/config/oidc.config"
import { getAppUrl } from "@/config/runtime-config"

/**
 * Single OIDC client for the whole app: the React provider (main.tsx) and the
 * non-React callers (axios interceptor, SSE streams) share its session.
 */
let userManagerInstance: UserManager | null = null

export function getUserManager(): UserManager {
  if (!userManagerInstance) {
    userManagerInstance = new UserManager(getOidcSettings())
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
 * Promise-based lock so concurrent callers share one refresh. With refresh
 * token rotation, two refreshes in parallel make the second one fail with
 * invalid_grant.
 */
let tokenRefreshPromise: Promise<string> | null = null

/**
 * Returns a valid access token, refreshing it when it has expired.
 *
 * @throws {AuthenticationRequiredError} when there is no session or it cannot be refreshed
 */
export async function getAccessToken(): Promise<string> {
  if (tokenRefreshPromise) return tokenRefreshPromise

  tokenRefreshPromise = (async () => {
    try {
      const userManager = getUserManager()
      const user = await userManager.getUser()
      if (user && !user.expired && user.access_token) return user.access_token
      if (!user) throw new AuthenticationRequiredError("No session. The user needs to sign in.")

      try {
        const refreshedUser = await userManager.signinSilent()
        if (!refreshedUser?.access_token) {
          throw new AuthenticationRequiredError("The provider returned no access token.")
        }
        return refreshedUser.access_token
      } catch (error) {
        if (error instanceof AuthenticationRequiredError) throw error
        throw new AuthenticationRequiredError(
          "The session could not be refreshed. The user needs to sign in again.",
          error,
        )
      }
    } finally {
      tokenRefreshPromise = null
    }
  })()

  return tokenRefreshPromise
}

export async function login(): Promise<void> {
  await getUserManager().signinRedirect()
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
