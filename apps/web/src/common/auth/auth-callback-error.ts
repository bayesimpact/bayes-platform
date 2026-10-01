/**
 * The identity provider reports a failed authorization by redirecting back to
 * the app with `error` and `error_description` in the query string (OAuth 2.0,
 * RFC 6749 section 4.1.2.1), for example
 * `?error=access_denied&error_description=User is not allowed to use this client`.
 *
 * Without a guard, a route that starts a login whenever the user is not
 * authenticated sends the browser straight back to the provider, which
 * answers with the same error: a redirect loop the user cannot escape.
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
