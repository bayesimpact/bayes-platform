import type { EditableProjectMembershipRoleDto } from "@caseai-connect/api-contracts"
import type { ProjectMemberAgent, ProjectMembership } from "./project-memberships.models"

export interface IProjectMembershipsSpi {
  getAll: (params: { organizationId: string; projectId: string }) => Promise<ProjectMembership[]>
  updateOne: (params: {
    organizationId: string
    projectId: string
    memberUserId: string
    role: EditableProjectMembershipRoleDto
  }) => Promise<ProjectMembership>
  remove: (params: {
    organizationId: string
    projectId: string
    memberUserId: string
  }) => Promise<void>
  getMemberAgents: (params: {
    organizationId: string
    projectId: string
    memberUserId: string
  }) => Promise<ProjectMemberAgent[]>
}
