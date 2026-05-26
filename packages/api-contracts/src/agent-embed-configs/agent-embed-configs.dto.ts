import type { TimeType } from "../generic"

export type AgentEmbedConfigDto = {
  id: string
  agentId: string
  embedToken: string
  isEnabled: boolean
  allowedOrigins: string[]
  title: string | null
  logoUrl: string | null
  primaryColor: string | null
  createdAt: TimeType
  updatedAt: TimeType
}

export type UpdateAgentEmbedConfigDto = {
  isEnabled?: boolean
  allowedOrigins?: string[]
  title?: string | null
  logoUrl?: string | null
  primaryColor?: string | null
}

/** Returned by the public (unauthenticated) config endpoint — branding only, no secrets. */
export type EmbedPublicConfigDto = {
  agentName: string
  title: string | null
  logoUrl: string | null
  primaryColor: string | null
}
