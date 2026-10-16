export type OAuthGrantClient = {
  clientId: string
  /** Name the client declared at registration, null when it gave none. */
  name: string | null
  /** True for a metadata document client: its domain was checked. */
  verified: boolean
}

export type OAuthGrantProject = {
  id: string
  name: string
}

/** Access a person granted to an MCP client through the consent page (ADR 0028). */
export type OAuthGrant = {
  id: string
  client: OAuthGrantClient
  projects: OAuthGrantProject[]
  permissions: string[]
  createdAt: number
  lastUsedAt: number | null
}
