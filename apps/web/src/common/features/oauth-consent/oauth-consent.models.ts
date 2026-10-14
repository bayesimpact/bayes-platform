import type { OAuthGrantablePermission } from "@caseai-connect/api-contracts"

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

export type OAuthConsentClient = {
  clientId: string
  name: string | null
  redirectHost: string
  verified: boolean
}

export type OAuthConsentProject = {
  id: string
  name: string
  organizationId: string
  organizationName: string
  availablePermissions: OAuthGrantablePermission[]
}

export type OAuthConsentPage = {
  client: OAuthConsentClient
  projects: OAuthConsentProject[]
  grantablePermissions: OAuthGrantablePermission[]
}

export type ApproveOAuthConsentInput = OAuthAuthorizationRequest & {
  projectIds: string[]
  permissions: OAuthGrantablePermission[]
}

export type ApproveOAuthConsentResult = {
  redirectTo: string
}
