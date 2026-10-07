import { type UserManagerSettings, WebStorageStateStore } from "oidc-client-ts"
import { getAppUrl, type RuntimeConfig, runtimeConfig } from "./runtime-config"

/** `offline_access` asks for a refresh token so sessions survive the access token expiry. */
export const DEFAULT_OIDC_SCOPE = "openid profile email offline_access"

type OidcRuntimeConfig = Pick<
  RuntimeConfig,
  "oidcAuthority" | "oidcClientId" | "oidcAudience" | "oidcScope" | "oidcAuthorizationParams"
>

/**
 * Settings of the OpenID Connect client (Authorization Code + PKCE) shared by
 * the React provider and the non-React code that needs a token.
 */
export function buildOidcSettings(
  config: OidcRuntimeConfig,
  appUrl: string,
  store: Storage = window.localStorage,
): UserManagerSettings {
  const extraQueryParams = {
    ...parseAuthorizationParams(config.oidcAuthorizationParams),
    // Some providers (Auth0) only issue a JWT access token for the API when
    // the audience is part of the authorization request.
    ...(config.oidcAudience ? { audience: config.oidcAudience } : {}),
  }
  return {
    authority: config.oidcAuthority,
    client_id: config.oidcClientId,
    redirect_uri: appUrl,
    post_logout_redirect_uri: appUrl,
    response_type: "code",
    scope: config.oidcScope?.trim() || DEFAULT_OIDC_SCOPE,
    // oidcClient.ts renews the token itself, under a lock shared by all tabs
    automaticSilentRenew: false,
    userStore: new WebStorageStateStore({ store }),
    ...(Object.keys(extraQueryParams).length > 0 ? { extraQueryParams } : {}),
  }
}

/** The API validates the value at boot; a broken build-time value is reported and ignored. */
function parseAuthorizationParams(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("not a JSON object")
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    )
  } catch (error) {
    console.error("Ignoring invalid oidcAuthorizationParams:", error)
    return {}
  }
}

export function getOidcSettings(): UserManagerSettings {
  return buildOidcSettings(runtimeConfig, getAppUrl())
}
