import type { TimeType } from "@caseai-connect/api-contracts"

export type AgentEmbedConfig = {
  id: string
  agentId: string
  embedToken: string
  isEnabled: boolean
  allowedOrigins: string[]
  createdAt: TimeType
  updatedAt: TimeType
}
