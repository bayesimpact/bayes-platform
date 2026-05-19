import type { ProjectMemberAgent, ProjectMembership } from "./project-memberships.models"

export interface IProjectMembershipsSpi {
  getAll: (params: { organizationId: string; projectId: string }) => Promise<ProjectMembership[]>
  remove: (params: {
    organizationId: string
    projectId: string
    membershipId: string
  }) => Promise<void>
  getMemberAgents: (params: {
    organizationId: string
    projectId: string
    membershipId: string
  }) => Promise<ProjectMemberAgent[]>
}
