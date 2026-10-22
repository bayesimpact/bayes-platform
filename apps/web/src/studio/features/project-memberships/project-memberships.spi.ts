import type { EditableProjectMembershipRoleDto } from "@caseai-connect/api-contracts"
import type {
  ProjectMemberAgent,
  ProjectMembership,
  ProjectRole,
} from "./project-memberships.models"

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
  getMemberAgents: (params: {
    organizationId: string
    projectId: string
    memberUserId: string
  }) => Promise<ProjectMemberAgent[]>
}
