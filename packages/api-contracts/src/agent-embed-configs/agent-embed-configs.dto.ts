import type { TimeType } from "../generic"

/** How the chat widget is rendered on the host page. Controlled via the data-display-mode attribute on the launcher script tag. */
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
