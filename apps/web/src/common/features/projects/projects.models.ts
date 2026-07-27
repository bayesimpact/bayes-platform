import type { FeatureFlagsDto, TimeType } from "@caseai-connect/api-contracts"

export type Project = {
  id: string
  name: string
  organizationId: string
  createdAt: TimeType
  updatedAt: TimeType
  featureFlags: FeatureFlagsDto
  agentSessionCategories: ProjectAgentSessionCategory[]
  conversationRetentionDays: number | null
}

export type ProjectAgentSessionCategory = {
  id: string
  name: string
}
