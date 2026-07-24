import type { FeatureFlagsDto } from "../feature-flags/feature-flags.dto"
import type { TimeType } from "../generic"

export type ProjectDto = {
  id: string
  name: string
  organizationId: string
  createdAt: TimeType
  updatedAt: TimeType
  featureFlags: FeatureFlagsDto
  agentSessionCategories: ProjectAgentSessionCategoryDto[]
}

export type ProjectAgentSessionCategoryDto = {
  id: string
  name: string
}

/** Slim project row for GET projects/mine, with the user's effective permissions. */
export type MyProjectDto = {
  id: string
  name: string
  organizationId: string
  featureFlags: FeatureFlagsDto
  permissions: string[]
}
