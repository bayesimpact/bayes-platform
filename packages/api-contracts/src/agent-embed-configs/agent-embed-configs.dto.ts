import type { TimeType } from "../generic"

export type EmbedDisplayMode = "modal" | "drawer"

export type AgentEmbedConfigDto = {
  id: string
  agentId: string
  embedToken: string
  isEnabled: boolean
  allowedOrigins: string[]
  title: string | null
  logoUrl: string | null
  primaryColor: string | null
  displayMode: EmbedDisplayMode
  createdAt: TimeType
  updatedAt: TimeType
}

export type UpdateAgentEmbedConfigDto = {
  isEnabled?: boolean
  allowedOrigins?: string[]
  title?: string | null
  logoUrl?: string | null
  primaryColor?: string | null
  displayMode?: EmbedDisplayMode
}

/** Returned by the public (unauthenticated) config endpoint — branding only, no secrets. */
export type EmbedPublicConfigDto = {
  agentName: string
  title: string | null
  logoUrl: string | null
  primaryColor: string | null
  displayMode: EmbedDisplayMode
}
