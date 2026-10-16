import type { ProjectMembershipDto } from "@caseai-connect/api-contracts"
import type { RoleGrant } from "@/domains/rbac/permission.types"
import type { ProjectMembershipModel } from "./project-membership.model"

export function toProjectMembershipDto(
  model: ProjectMembershipModel,
  roleGrant: RoleGrant | undefined,
): ProjectMembershipDto {
  return {
    id: model.id,
    projectId: model.projectId,
    userId: model.userId,
    userName: model.user.name,
    userEmail: model.user.email,
    userHasSignedIn: model.user.authSubject !== null,
    createdAt: model.createdAt.getTime(),
    role: model.role,
    permissions: roleGrant?.permissions ?? [],
  }
}
