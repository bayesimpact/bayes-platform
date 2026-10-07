import { useAuth } from "react-oidc-context"
import { useLocation } from "react-router-dom"
import { type AuthCallbackError, getAuthCallbackError } from "./auth-callback-error"

/**
 * The error the identity provider put in the URL, or the one the OIDC client
 * hit on its own (unreachable provider, invalid callback), or null. Routes
 * that start a login must render AuthErrorRoute when this is set, instead of
 * redirecting to the provider again.
 *
 * A failed background token renewal is not a sign-in failure: the stored
 * session may still be valid (the network was down for a moment, the laptop
 * just woke up), and the next API call refreshes it or logs the user out.
 */
export function useAuthCallbackError(): AuthCallbackError | null {
  const { search } = useLocation()
  const { error } = useAuth()
  const urlError = getAuthCallbackError(search)
  if (urlError) return urlError
  if (error && error.source !== "renewSilent")
    return { code: error.name, description: error.message }
  return null
}
