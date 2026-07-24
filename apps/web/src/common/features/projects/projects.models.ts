import type { FeatureFlagsDto, TimeType } from "@caseai-connect/api-contracts"

export type Project = {
  id: string
  name: string
  organizationId: string
  createdAt: TimeType
  updatedAt: TimeType
  featureFlags: FeatureFlagsDto
  agentSessionCategories: ProjectAgentSessionCategory[]
}

export type ProjectAgentSessionCategory = {
  id: string
  name: string
}

/** Slim project the current user can access, with their effective permissions. */
export type MyProject = {
  id: string
  name: string
  organizationId: string
  featureFlags: FeatureFlagsDto
  permissions: string[]
}
