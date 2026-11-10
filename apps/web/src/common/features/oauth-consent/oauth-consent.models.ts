/** Authorization request of an OAuth client, with the protocol's own parameter names. */
export type OAuthAuthorizationRequest = {
  response_type: "code"
  client_id: string
  redirect_uri: string
  state?: string
  code_challenge: string
  code_challenge_method: "S256"
  scope?: string
  resource?: string
}

/**
 * - mcp: a client acting as the person, on the projects they pick
 * - app: an app installed on one workspace, acting as its own service account
 */
export type OAuthConsentClientKind = "mcp" | "app"

export type OAuthConsentClient = {
  clientId: string
  kind: OAuthConsentClientKind
  name: string | null
  redirectHost: string
  verified: boolean
  /** An app's description and logo, from its manifest. */
  description: string | null
  logoUrl: string | null
}

/**
 * Who installed an app on a workspace, as the person looking sees them. A member who left (soft
 * deleted) and an account that no longer exists (hard deleted) both show as a former member.
 */
export type AppInstaller =
  | { kind: "me" }
  | { kind: "member"; name: string | null; email: string }
  | { kind: "former-member" }

export type OAuthConsentProject = {
  id: string
  name: string
  organizationId: string
  organizationName: string
  availablePermissions: string[]
  /** Who installed the app on this workspace, null when it is not installed there. */
  installedBy: AppInstaller | null
}

export type OAuthConsentPage = {
  client: OAuthConsentClient
  projects: OAuthConsentProject[]
  grantablePermissions: string[]
}

export type ApproveOAuthConsentInput = OAuthAuthorizationRequest & {
  projectIds: string[]
  permissions: string[]
}

export type ApproveOAuthConsentResult = {
  redirectTo: string
}
