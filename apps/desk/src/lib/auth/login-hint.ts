/**
 * Standard OpenID Connect authorize parameter (Core 1.0, section 3.1.2.1): the provider pre-fills
 * its sign-in and sign-up screens with this email. An agent invitation's link carries it.
 */
const LOGIN_HINT_QUERY_PARAM = "login_hint"

/** The login hint a URL's query carries, if any. */
export function readLoginHint(search: string): string | undefined {
  const loginHint = new URLSearchParams(search).get(LOGIN_HINT_QUERY_PARAM)?.trim()
  return loginHint || undefined
}
