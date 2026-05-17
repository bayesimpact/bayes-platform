import {
  type FeatureFlagKey,
  FeatureFlags,
  type OrganizationMembershipRoleDto,
  type ProjectMembershipRoleDto,
} from "@caseai-connect/api-contracts"
import { ROLES } from "@/common/features/me/me.models"
import type { Project } from "@/common/features/projects/projects.models"

export function sortRecentlyCreated<T extends { createdAt: number }>(a: T, b: T) {
  return b.createdAt - a.createdAt
}

export type BaseStoryArgs = {
  organizationMembershipRole: OrganizationMembershipRoleDto
  projectMembershipRole: ProjectMembershipRoleDto
  featureFlags?: Project["featureFlags"]
}

export const baseStoryArgs = {
  organizationMembershipRole: "owner",
  projectMembershipRole: "owner",
  featureFlags: [],
} satisfies BaseStoryArgs

export const baseStoryArgTypes = {
  organizationMembershipRole: { control: "select", options: ROLES },
  projectMembershipRole: { control: "select", options: ROLES },
  featureFlags: {
    control: "inline-check",
    options: FeatureFlags.map((flag) => flag.key) as FeatureFlagKey[],
  },
} as const
