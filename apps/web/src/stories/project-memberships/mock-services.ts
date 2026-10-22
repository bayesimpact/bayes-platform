import { SAMPLE_ASSIGNABLE_ROLES } from "@/studio/features/project-memberships/project-memberships.factory"
import type {
  MemberRoles,
  ProjectMembership,
} from "@/studio/features/project-memberships/project-memberships.models"
import type { IProjectMembershipsSpi } from "@/studio/features/project-memberships/project-memberships.spi"

/** A project memberships service that returns what the story seeded, and changes nothing. */
export function buildMockProjectMembershipsService(
  overrides: { memberships?: ProjectMembership[]; memberRoles?: MemberRoles } = {},
): IProjectMembershipsSpi {
  return {
    async getAll() {
      return overrides.memberships ?? []
    },
    async getAssignableRoles() {
      return SAMPLE_ASSIGNABLE_ROLES
    },
    async addRoles() {
      return []
    },
    async removeMany() {},
    async getMemberRoles() {
      if (!overrides.memberRoles) throw new Error("No member roles in this story")
      return overrides.memberRoles
    },
    async removeRole() {},
    async addAgentRole() {},
    async removeAgentRole() {},
    async addCampaignRole() {},
    async revokeCampaignRole() {},
  }
}
