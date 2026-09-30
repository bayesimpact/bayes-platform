/**
 * Settings of the OpenID Connect provider that authenticates platform users.
 *
 * Any standard provider works (Keycloak, Dex, Auth0, Okta, ...). The API only
 * needs the issuer: the JWKS and userinfo endpoints come from the provider's
 * discovery document.
 *
 * Read lazily so that processes which never authenticate a user (workers,
 * scripts, tests) can boot without the OIDC_* variables.
 */

/** Must equal the `iss` claim of the access tokens, trailing slash included. */
export function getOidcIssuerUrl(env: NodeJS.ProcessEnv = process.env): string {
  const issuerUrl = env.OIDC_ISSUER_URL?.trim()
  if (!issuerUrl) {
    throw new Error("OIDC_ISSUER_URL is not configured")
  }
  return issuerUrl
}

/** Checked against the `aud` claim when set. Some providers (Keycloak by default) set none. */
export function getOidcAudience(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.OIDC_AUDIENCE?.trim() || undefined
}

/**
 * Extra parameters added to the authorization request, as a JSON object of
 * strings, for example `{"organization":"org_123"}` to keep Auth0 users in
 * one organization, or `{"kc_idp_hint":"corporate"}` for Keycloak.
 * The web app and Bull Board both send them.
 */
export function getOidcAuthorizationParams(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> {
  return parseOidcAuthorizationParams(env.OIDC_AUTHORIZATION_PARAMS)
}

export function parseOidcAuthorizationParams(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(
      'OIDC_AUTHORIZATION_PARAMS must be a JSON object, for example {"organization":"org_123"}',
    )
  }
  const isStringRecord =
    typeof parsed === "object" &&
    parsed !== null &&
    !Array.isArray(parsed) &&
    Object.values(parsed).every((value) => typeof value === "string")
  if (!isStringRecord) {
    throw new Error("OIDC_AUTHORIZATION_PARAMS must be a JSON object whose values are strings")
  }
  return parsed as Record<string, string>
}

export type OidcEmailLinkingPolicy = {
  /**
   * Links a first sign-in to the existing account that has the same email,
   * which is how people added by email get their access. On by default.
   */
  allowEmailLinking: boolean
  /**
   * Links by email even when the provider does not say the email is verified.
   * Only for a single-tenant provider fully controlled by the customer.
   */
  trustUnverifiedEmail: boolean
}

export function getOidcEmailLinkingPolicy(
  env: NodeJS.ProcessEnv = process.env,
): OidcEmailLinkingPolicy {
  return {
    allowEmailLinking: parseBoolean(env.OIDC_ALLOW_EMAIL_LINKING, true),
    trustUnverifiedEmail: parseBoolean(env.OIDC_TRUST_UNVERIFIED_EMAIL, false),
  }
}

/** `https://idp.example.com/realms/acme/` → `https://idp.example.com/realms/acme/.well-known/openid-configuration` */
export function buildDiscoveryUrl(issuerUrl: string): string {
  return `${issuerUrl.replace(/\/+$/u, "")}/.well-known/openid-configuration`
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === "") return defaultValue
  return value.trim().toLowerCase() === "true"
}
