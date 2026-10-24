import { type UserManagerSettings, WebStorageStateStore } from "oidc-client-ts"
import type { OidcConfig } from "@/app/config"

/** `offline_access` asks for a refresh token, so a session outlives its access token. */
export const DEFAULT_OIDC_SCOPE = "openid profile email offline_access"

/**
 * The prefix of everything the Desk's sign-in keeps in the browser. apps/web keeps the same entries
 * under oidc-client-ts's default prefix on the same origin: with its own prefix, the Desk never
 * shares or rotates apps/web's refresh token.
 */
export const OIDC_STORE_PREFIX = "desk.oidc."

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
    // oidc-client.ts renews the token itself, under a lock shared by the Desk's tabs.
    automaticSilentRenew: false,
    userStore: new WebStorageStateStore({ store, prefix: OIDC_STORE_PREFIX }),
    stateStore: new WebStorageStateStore({ store, prefix: OIDC_STORE_PREFIX }),
    ...(Object.keys(extraQueryParams).length > 0 ? { extraQueryParams } : {}),
  }
}
