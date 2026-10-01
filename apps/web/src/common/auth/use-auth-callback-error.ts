import { useAuth } from "react-oidc-context"
import { useLocation } from "react-router-dom"
import { type AuthCallbackError, getAuthCallbackError } from "./auth-callback-error"

/**
 * The error the identity provider put in the URL, or the one the OIDC client
 * hit on its own (unreachable provider, invalid callback), or null. Routes
 * that start a login must render AuthErrorRoute when this is set, instead of
 * redirecting to the provider again.
 */
export function useAuthCallbackError(): AuthCallbackError | null {
  const { search } = useLocation()
  const { error } = useAuth()
  const urlError = getAuthCallbackError(search)
  if (urlError) return urlError
  if (error) return { code: error.name, description: error.message }
  return null
}
