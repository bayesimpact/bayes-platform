import type { TimeType } from "@caseai-connect/api-contracts"

export type AgentEmbedConfig = {
  id: string
  agentId: string
  embedToken: string
  isEnabled: boolean
  allowedOrigins: string[]
  title: string | null
  logoUrl: string | null
  primaryColor: string | null
  bannerText: string | null
  createdAt: TimeType
  updatedAt: TimeType
}
