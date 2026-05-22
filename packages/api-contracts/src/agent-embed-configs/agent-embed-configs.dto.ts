import type { TimeType } from "../generic"

export type AgentEmbedConfigDto = {
  id: string
  agentId: string
  embedToken: string
  isEnabled: boolean
  allowedOrigins: string[]
  createdAt: TimeType
  updatedAt: TimeType
}

export type UpdateAgentEmbedConfigDto = {
  isEnabled?: boolean
  allowedOrigins?: string[]
}
