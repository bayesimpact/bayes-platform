import type { McpServerAuthMethod } from "@caseai-connect/api-contracts"

export type McpServerConfig = {
  url: string
  /**
   * Authentication mechanism chosen at creation. Distinguishes a deliberately
   * unauthenticated server ("none") from one awaiting its first OAuth
   * authorization ("oauth"), which are otherwise identical in the blob.
   */
  authMethod?: McpServerAuthMethod
  apiKey?: string
  /**
   * Static headers sent on every call to this server, for whatever a given
   * server expects beyond its auth (an API version, a tenant). Stored in the
   * encrypted config blob, so adding them needs no migration. The conversation
   * context is applied after them and cannot be overridden here.
   */
  headers?: Record<string, string>
  oauth?: McpServerOauthState
}

export type EnabledMcpServer = McpServerConfig & {
  id: string
}

export type McpServerOauthTokens = {
  accessToken: string
  refreshToken?: string
  /**
   * Epoch ms after which accessToken must be refreshed. Absent when the token
   * response carried no `expires_in`: the token is then used until the server
   * rejects it.
   */
  expiresAt?: number
}

export type McpServerOauthPendingAuth = {
  state: string
  codeVerifier: string
  redirectUri: string
  /** Epoch ms; a pending authorization is single-use and short-lived. */
  expiresAt: number
}

/**
 * OAuth 2.1 state for servers using the MCP Authorization spec. Lives in the
 * encrypted config blob, so adding fields needs no migration.
 */
export type McpServerOauthState = {
  clientId: string
  authorizationEndpoint: string
  tokenEndpoint: string
  /** Canonical resource URI (RFC 8707), sent on authorize and token calls. */
  resource: string
  scope?: string
  tokens?: McpServerOauthTokens
  pendingAuth?: McpServerOauthPendingAuth
}
