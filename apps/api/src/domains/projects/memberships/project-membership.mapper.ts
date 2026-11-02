import type { ProjectMembershipDto } from "@caseai-connect/api-contracts"
import { toMembershipRoleDto } from "@/domains/rbac/membership-roles"
import type { ResolvedRole } from "@/domains/rbac/permission.types"
import { unionRolePermissions } from "@/domains/rbac/union-role-permissions"
import type { ProjectMembershipModel } from "./project-membership.model"

export function toProjectMembershipDto(
  model: ProjectMembershipModel,
  rolesById: ReadonlyMap<string, ResolvedRole>,
): ProjectMembershipDto {
  return {
    projectId: model.projectId,
    userId: model.userId,
    userName: model.user.name,
    userEmail: model.user.email,
    userHasSignedIn: model.user.authSubject !== null,
    createdAt: model.createdAt.getTime(),
    roles: model.roles.map(toMembershipRoleDto),
    permissions: unionRolePermissions(model.roles, rolesById),
  }
}
