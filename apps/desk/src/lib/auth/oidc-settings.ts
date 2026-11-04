import { type UserManagerSettings, WebStorageStateStore } from "oidc-client-ts"
import type { OidcConfig } from "@/app/config"

/** `offline_access` asks for a refresh token, so a session outlives its access token. */
export const DEFAULT_OIDC_SCOPE = "openid profile email offline_access"

/**
 * The prefix of the session that every app of the platform shares on this origin: apps/web keeps
 * its session under oidc-client-ts's default prefix, which is this one. A person signed in to one
 * app is signed in to all of them, with the same account.
 */
const SESSION_STORE_PREFIX = "oidc."

/**
 * The prefix of what only the Desk keeps in the browser: the state of a sign-in it started, and the
 * page to return to. A sign-in comes back to the redirect URI of the app that started it.
 */
export const DESK_STORE_PREFIX = "desk.oidc."

/** The key of the session every app shares: the one oidc-client-ts gives the stored user. */
export function sessionStorageKey({
  authority,
  client_id,
}: Pick<UserManagerSettings, "authority" | "client_id">): string {
  return `${SESSION_STORE_PREFIX}user:${authority}:${client_id}`
}

/**
 * The Desk kept a session of its own under `desk.oidc.` until every app shared one. That session
 * becomes the shared one when there is none yet, and is forgotten either way: its refresh token
 * would otherwise stay in the browser, unused.
 */
export function adoptDeskSession(
  settings: Pick<UserManagerSettings, "authority" | "client_id">,
  store: Storage = window.localStorage,
): void {
  const sharedKey = sessionStorageKey(settings)
  const deskKey = `${DESK_STORE_PREFIX}user:${settings.authority}:${settings.client_id}`
  const deskSession = store.getItem(deskKey)
  if (deskSession === null) return
  if (store.getItem(sharedKey) === null) store.setItem(sharedKey, deskSession)
  store.removeItem(deskKey)
}

/** The OpenID Connect client of the Desk: authorization code with PKCE, renewed by oidc-client.ts. */
export function buildOidcSettings(
  config: Pick<
    OidcConfig,
    "oidcAuthority" | "oidcClientId" | "oidcAudience" | "oidcScope" | "oidcAuthorizationParams"
  >,
  appUrl: string,
  store: Storage = window.localStorage,
): UserManagerSettings {
  const extraQueryParams = {
    ...config.oidcAuthorizationParams,
    // Some providers (Auth0) only issue a JWT access token for the API when the audience is part
    // of the authorization request.
    ...(config.oidcAudience ? { audience: config.oidcAudience } : {}),
  }
  return {
    authority: config.oidcAuthority,
    client_id: config.oidcClientId,
    redirect_uri: `${appUrl}auth/callback`,
    post_logout_redirect_uri: appUrl,
    response_type: "code",
    scope: config.oidcScope ?? DEFAULT_OIDC_SCOPE,
    // oidc-client.ts renews the token itself, under a lock shared by every app and tab.
    automaticSilentRenew: false,
    userStore: new WebStorageStateStore({ store, prefix: SESSION_STORE_PREFIX }),
    stateStore: new WebStorageStateStore({ store, prefix: DESK_STORE_PREFIX }),
    ...(Object.keys(extraQueryParams).length > 0 ? { extraQueryParams } : {}),
  }
}
