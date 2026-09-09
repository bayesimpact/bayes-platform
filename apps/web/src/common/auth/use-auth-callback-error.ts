import { useLocation } from "react-router-dom"
import { type AuthCallbackError, getAuthCallbackError } from "./auth-callback-error"

/**
 * The error Auth0 put in the URL when the authorization failed, or null.
 * Routes that start a login must render AuthErrorRoute when this is set,
 * instead of redirecting to Auth0 again.
 */
export function useAuthCallbackError(): AuthCallbackError | null {
  const { search } = useLocation()
  return getAuthCallbackError(search)
}
