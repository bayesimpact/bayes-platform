/**
 * Auth0 reports a failed authorization by redirecting back to the app with
 * `error` and `error_description` in the query string, for example
 * `?error=invalid_request&error_description=parameter organization is not allowed for this client`.
 *
 * Without a guard, a route that calls loginWithRedirect whenever the user is
 * not authenticated sends the browser straight back to Auth0, which answers
 * with the same error: a redirect loop the user cannot escape.
 */
export type AuthCallbackError = {
  code: string
  description: string | null
}

export function getAuthCallbackError(search: string): AuthCallbackError | null {
  const params = new URLSearchParams(search)
  const code = params.get("error")
  if (!code) return null
  return { code, description: params.get("error_description") }
}
