import type { EmbedDisplayMode, TimeType } from "@caseai-connect/api-contracts"

export type AgentEmbedConfig = {
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
