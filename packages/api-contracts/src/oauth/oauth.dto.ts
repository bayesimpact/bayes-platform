import { z } from "zod"
import { isLoopbackHostname } from "../apps/loopback-redirect"

/**
 * Permissions a person can grant to an OAuth client (ADR 0028). Each one is
 * checked against the person's own rights when the client uses it:
 * - project.read: the project (RBAC `project.read`)
 * - agent.create: the project (RBAC `agent.create`). It also lets the client copy
 *   an agent the person owns or administers (RBAC `agent.duplicate` on the agent).
 * - agent.settings.draft.update: each agent (RBAC `agent.settings.draft.update`,
 *   held as owner or admin of the agent). Publishing stays in the studio.
 */
export const OAUTH_GRANTABLE_PERMISSIONS = [
  "project.read",
  "agent.create",
  "agent.settings.draft.update",
] as const
export type OAuthGrantablePermission = (typeof OAUTH_GRANTABLE_PERMISSIONS)[number]

export const OAUTH_MAX_REDIRECT_URIS = 5

/**
 * Schemes a browser runs or reads locally instead of handing them to an app:
 * a code sent there would execute script or reach local files.
 */
const FORBIDDEN_REDIRECT_SCHEMES = new Set([
  "javascript",
  "data",
  "vbscript",
  "file",
  "filesystem",
  "blob",
  "about",
  "chrome",
  "view-source",
  "ws",
  "wss",
  "ftp",
])

/**
 * Redirect URIs a client may register (RFC 8252 and OAuth 2.1):
 * - https
 * - http on a loopback host, any port (native apps listening locally)
 * - a private-use scheme of a native app: reverse domain form
 *   (`com.example.app:/callback`) as RFC 8252 recommends, or a short one
 *   (`claude://…`, `cursor://…`) as many MCP clients use. Another app could
 *   claim the same scheme, which PKCE makes harmless: the code is useless
 *   without the verifier the real client holds.
 * No fragment.
 */
export function isAllowedOAuthRedirectUri(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.hash) return false
  if (url.protocol === "https:") return true
  if (url.protocol === "http:") return isLoopbackHostname(url.hostname)
  const scheme = url.protocol.slice(0, -1)
  return /^[a-z][a-z0-9+.-]*$/.test(scheme) && !FORBIDDEN_REDIRECT_SCHEMES.has(scheme)
}

/**
 * Exact match, except the port of a loopback redirect (RFC 8252 section 7.3):
 * a native app picks a free port at each sign-in.
 */
export function oauthRedirectUriMatches(registered: string, requested: string): boolean {
  if (registered === requested) return true
  let registeredUrl: URL
  let requestedUrl: URL
  try {
    registeredUrl = new URL(registered)
    requestedUrl = new URL(requested)
  } catch {
    return false
  }
  if (registeredUrl.protocol !== "http:" || !isLoopbackHostname(registeredUrl.hostname)) {
    return false
  }
  registeredUrl.port = ""
  requestedUrl.port = ""
  return registeredUrl.toString() === requestedUrl.toString()
}

const redirectUriSchema = z
  .string()
  .max(2048)
  .refine(
    isAllowedOAuthRedirectUri,
    "redirect_uri must be https, loopback http or a private-use scheme",
  )

/** RFC 7591 registration request, the fields the server reads. */
export const oauthClientRegistrationSchema = z.object({
  redirect_uris: z.array(redirectUriSchema).min(1).max(OAUTH_MAX_REDIRECT_URIS),
  client_name: z.string().trim().min(1).max(200).optional(),
  token_endpoint_auth_method: z.literal("none").default("none"),
  grant_types: z
    .array(z.enum(["authorization_code", "refresh_token"]))
    .default(["authorization_code", "refresh_token"]),
  response_types: z.array(z.literal("code")).default(["code"]),
})
export type OAuthClientRegistrationDto = z.input<typeof oauthClientRegistrationSchema>

export type OAuthClientRegistrationResponseDto = {
  client_id: string
  client_id_issued_at: number
  client_name?: string
  redirect_uris: string[]
  token_endpoint_auth_method: "none"
  grant_types: string[]
  response_types: string[]
}

/** Query of the authorization request, as the client sends it to the web app. */
export const oauthAuthorizationRequestSchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string().min(1).max(2048),
  redirect_uri: z.string().min(1).max(2048),
  state: z.string().max(1024).optional(),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
  code_challenge_method: z.literal("S256"),
  scope: z.string().max(1024).optional(),
  resource: z.string().max(2048).optional(),
})
export type OAuthAuthorizationRequestDto = z.infer<typeof oauthAuthorizationRequestSchema>

export type OAuthConsentProjectDto = {
  id: string
  name: string
  organizationId: string
  organizationName: string
  /** Grantable permissions the person holds on the project, the ones worth offering. */
  availablePermissions: string[]
}

/**
 * - mcp: a client acting as the person, on the projects they pick (ADR 0028)
 * - app: an app installed on one project, acting as its own service user (ADR 0029)
 */
export type OAuthClientKind = "mcp" | "app"

export type OAuthConsentPageDto = {
  client: {
    clientId: string
    kind: OAuthClientKind
    name: string | null
    /** Host the person is sent back to. */
    redirectHost: string
    /** True when the platform vouches for the name: a metadata document client, or an app. */
    verified: boolean
    /** An app's description and logo, from its manifest. */
    description: string | null
    logoUrl: string | null
  }
  /** For an app, the projects the person can install it on. */
  projects: OAuthConsentProjectDto[]
  /** The MCP permissions, or the ones of the app's manifest. */
  grantablePermissions: string[]
}

export const oauthConsentSchema = oauthAuthorizationRequestSchema.extend({
  /** Exactly one for an app. */
  projectIds: z.array(z.uuid()).min(1).max(50),
  /** Checked by the server against the client's grantable permissions. */
  permissions: z.array(z.string().min(1).max(100)).min(1).max(50),
})
export type OAuthConsentDto = z.infer<typeof oauthConsentSchema>

export type OAuthConsentResponseDto = {
  /** Where the browser goes next: the client's redirect URI with the code and state. */
  redirectTo: string
}

/**
 * Client authentication at the token and revocation endpoints: the id alone
 * for a public client, plus the secret for an app (`client_secret_post`). With
 * `client_secret_basic`, the server reads both from the Authorization header.
 */
const clientAuthenticationFields = {
  client_id: z.string().min(1).max(2048),
  client_secret: z.string().min(1).max(512).optional(),
}

/** Token request, form-encoded (RFC 6749 section 4.1.3 and 6). */
export const oauthTokenRequestSchema = z.discriminatedUnion("grant_type", [
  z.object({
    grant_type: z.literal("authorization_code"),
    code: z.string().min(1).max(512),
    redirect_uri: z.string().min(1).max(2048),
    code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
    resource: z.string().max(2048).optional(),
    ...clientAuthenticationFields,
  }),
  z.object({
    grant_type: z.literal("refresh_token"),
    refresh_token: z.string().min(1).max(512),
    resource: z.string().max(2048).optional(),
    ...clientAuthenticationFields,
  }),
])
export type OAuthTokenRequestDto = z.infer<typeof oauthTokenRequestSchema>

export type OAuthTokenResponseDto = {
  access_token: string
  token_type: "Bearer"
  expires_in: number
  refresh_token: string
  scope: string
}

export type OAuthErrorResponseDto = {
  error: string
  error_description?: string
}

export const oauthRevocationRequestSchema = z.object({
  token: z.string().min(1).max(512),
  token_type_hint: z.string().optional(),
  ...clientAuthenticationFields,
})

export type OAuthGrantDto = {
  id: string
  client: { clientId: string; name: string | null; verified: boolean }
  projects: { id: string; name: string }[]
  permissions: string[]
  createdAt: number
  lastUsedAt: number | null
}
