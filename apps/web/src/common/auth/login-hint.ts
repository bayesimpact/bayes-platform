import { getAppUrl } from "@/config/runtime-config"

/**
 * Standard OpenID Connect authorize parameter (Core 1.0, section 3.1.2.1): the
 * provider pre-fills its login and sign-up screens with this email.
 */
export const LOGIN_HINT_QUERY_PARAM = "login_hint"

/** Link to send to an invited person, so they sign in or sign up with the invited email. */
export function buildInvitationLink(email: string, appUrl: string = getAppUrl()): string {
  return `${appUrl}/?${LOGIN_HINT_QUERY_PARAM}=${encodeURIComponent(email)}`
}

/** The login hint carried by the current page URL, if any. */
export function readLoginHint(search: string = window.location.search): string | undefined {
  const loginHint = new URLSearchParams(search).get(LOGIN_HINT_QUERY_PARAM)?.trim()
  return loginHint || undefined
}
