import { type FeatureFlagKey, FeatureFlags } from "@caseai-connect/api-contracts"
import { ROLES } from "@/common/features/me/me.models"
import type { LegacyMembershipRole } from "@/common/features/memberships/membership-roles"
import type { Project } from "@/common/features/projects/projects.models"

export function sortRecentlyCreated<T extends { createdAt: number }>(a: T, b: T) {
  return b.createdAt - a.createdAt
}

export type BaseStoryArgs = {
  organizationMembershipRole: LegacyMembershipRole
  projectMembershipRole: LegacyMembershipRole
  agentMembershipRole: LegacyMembershipRole
  featureFlags?: Project["featureFlags"]
}

export const baseStoryArgs = {
  organizationMembershipRole: "owner",
  projectMembershipRole: "owner",
  agentMembershipRole: "owner",
  featureFlags: [],
} satisfies BaseStoryArgs

export const baseStoryArgTypes = {
  organizationMembershipRole: { control: "select", options: ROLES },
  projectMembershipRole: { control: "select", options: ROLES },
  agentMembershipRole: { control: "select", options: ROLES },
  featureFlags: {
    control: "inline-check",
    options: FeatureFlags.map((flag) => flag.key) as FeatureFlagKey[],
  },
} as const
