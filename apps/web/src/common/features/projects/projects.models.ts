import type { FeatureFlagsDto, TimeType } from "@caseai-connect/api-contracts"

export type Project = {
  id: string
  name: string
  organizationId: string
  createdAt: TimeType
  updatedAt: TimeType
  featureFlags: FeatureFlagsDto
  agentSessionCategories: ProjectSessionCategory[]
}

export type ProjectSessionCategory = {
  id: string
  name: string
}
