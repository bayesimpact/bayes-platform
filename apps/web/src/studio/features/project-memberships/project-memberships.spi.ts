import type { MemberRoles, ProjectMembership, ProjectRole } from "./project-memberships.models"

type MemberScope = { organizationId: string; projectId: string; memberUserId: string }

export interface IProjectMembershipsSpi {
  getAll: (params: { organizationId: string; projectId: string }) => Promise<ProjectMembership[]>
  getAssignableRoles: (params: {
    organizationId: string
    projectId: string
  }) => Promise<ProjectRole[]>
  /** All or nothing. Returns the members with their new roles. */
  addRoles: (params: {
    organizationId: string
    projectId: string
    memberUserIds: string[]
    roleKeys: string[]
  }) => Promise<ProjectMembership[]>
  /** All or nothing. */
  removeMany: (params: {
    organizationId: string
    projectId: string
    memberUserIds: string[]
  }) => Promise<void>
  getMemberRoles: (params: MemberScope) => Promise<MemberRoles>
  /** Takes one workspace role from the member. */
  removeRole: (params: MemberScope & { roleKey: string }) => Promise<void>
  addAgentRole: (params: MemberScope & { agentId: string; roleKey: string }) => Promise<void>
  removeAgentRole: (params: MemberScope & { agentId: string; roleKey: string }) => Promise<void>
  addCampaignRole: (
    params: MemberScope & { reviewCampaignId: string; roleKey: string },
  ) => Promise<void>
  /** A campaign role is revoked by its membership row. */
  revokeCampaignRole: (params: {
    organizationId: string
    projectId: string
    reviewCampaignId: string
    membershipId: string
  }) => Promise<void>
}
