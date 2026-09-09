import { type Auth0Client, createAuth0Client } from "@auth0/auth0-spa-js"
import { auth0ClientConfig } from "@/config/auth0.config"
import { getAppUrl } from "@/config/runtime-config"

/**
 * Singleton Auth0 client instance.
 * Initialized once and reused throughout the application.
 */
let auth0ClientInstance: Auth0Client | null = null

/**
 * Promise-based lock to prevent concurrent token refresh attempts.
 * This prevents race conditions where multiple simultaneous calls to getTokenSilently()
 * could cause invalid_grant errors when refresh token rotation is enabled.
 *
 * When a token refresh is in progress, subsequent calls will wait for the same refresh
 * to complete instead of initiating new refresh attempts.
 */
let tokenRefreshPromise: Promise<string> | null = null

/**
 * Custom error class for Auth0 authentication errors.
 * These errors indicate that the user needs to re-authenticate.
 */
export class Auth0AuthenticationError extends Error {
  constructor(
    message: string,
    public readonly errorCode: string,
    public readonly originalError?: unknown,
  ) {
    super(message)
    this.name = "Auth0AuthenticationError"
  }
}

/**
 * Checks if an error is an Auth0 authentication error that requires re-authentication.
 * Common error codes: invalid_grant, login_required, consent_required, etc.
 *
 * Auth0 SPA JS SDK throws GenericError or AuthenticationError instances with
 * `error` and `error_description` properties.
 */
function isAuth0AuthenticationError(
  error: unknown,
): error is { error: string; error_description?: string } {
  if (typeof error !== "object" || error === null) {
    return false
  }

  const errorObj = error as Record<string, unknown>
  const errorCode = errorObj.error

  if (typeof errorCode !== "string") {
    return false
  }

  // These error codes indicate the user needs to re-authenticate
  const authRequiredErrors = [
    "invalid_grant", // Refresh token is invalid/expired
    "login_required", // User needs to log in again
    "consent_required", // User needs to grant consent again
    "interaction_required", // User interaction is required
    "missing_refresh_token", // No refresh token available
  ]

  return authRequiredErrors.includes(errorCode)
}

/**
 * Gets or initializes the Auth0 client instance.
 * The client is initialized lazily on first access.
 */
export async function getAuth0Client(): Promise<Auth0Client> {
  if (!auth0ClientInstance) {
    auth0ClientInstance = await createAuth0Client(auth0ClientConfig)
  }
  return auth0ClientInstance
}

/**
 * Logs out the user using the Auth0 client.
 * This clears the Auth0 session and redirects to the home page.
 */
export async function logoutAuth0(): Promise<void> {
  const client = await getAuth0Client()
  await client.logout({
    logoutParams: {
      returnTo: getAppUrl(),
    },
  })
}

/**
 * Gets an access token using the Auth0 client.
 * This automatically handles token refresh and caching.
 *
 * Implements a promise-based lock to prevent race conditions when multiple
 * concurrent requests try to refresh the token simultaneously. This is especially
 * important when refresh token rotation is enabled, as concurrent refresh attempts
 * can cause invalid_grant errors.
 *
 * When multiple calls happen concurrently:
 * - The first call initiates the token refresh
 * - Subsequent calls wait for the same refresh promise
 * - Once the refresh completes, all waiting calls receive the same token
 * - The lock is cleared, allowing future refreshes
 *
 * @throws {Auth0AuthenticationError} When authentication fails and user needs to re-authenticate
 * @throws {Error} When token retrieval fails for other reasons
 */
export async function getAccessToken(): Promise<string> {
  // If a token refresh is already in progress, wait for it instead of starting a new one
  if (tokenRefreshPromise) {
    return tokenRefreshPromise
  }

  // Start a new token refresh attempt
  tokenRefreshPromise = (async () => {
    try {
      const client = await getAuth0Client()
      const token = await client.getTokenSilently({
        cacheMode: "on",
      })

      if (!token) {
        throw new Error("Failed to get access token. User may not be authenticated.")
      }

      return token
    } catch (error) {
      // Check if this is an Auth0 authentication error that requires re-authentication
      if (isAuth0AuthenticationError(error)) {
        throw new Auth0AuthenticationError(
          `Authentication failed: ${error.error}. User needs to re-authenticate.`,
          error.error,
          error,
        )
      }

      // Re-throw other errors as-is
      throw error
    } finally {
      // Clear the lock after the refresh completes (success or failure)
      // All concurrent callers will have received the result by this point
      tokenRefreshPromise = null
    }
  })()

  return tokenRefreshPromise
}
