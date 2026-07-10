import { ProjectScopedPolicy } from "@/common/policies/project-scoped-policy"
import type { ProjectMembershipModel } from "./project-membership.model"

export class ProjectMembershipPolicy extends ProjectScopedPolicy<ProjectMembershipModel> {
  canList(): boolean {
    return this.canAccess() && this.isProjectAdminOrOwner()
  }

  canCreate(): boolean {
    return this.canList()
  }

  canUpdate(): boolean {
    return this.canList()
  }

  canDelete(): boolean {
    return this.canList()
  }
}
