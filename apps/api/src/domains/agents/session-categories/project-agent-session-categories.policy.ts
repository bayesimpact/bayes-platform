import { ProjectScopedPolicy } from "@/common/policies/project-scoped-policy"

export class ProjectAgentSessionCategoriesPolicy extends ProjectScopedPolicy<never> {
  canCreate(): boolean {
    return this.canAccess() && this.isProjectAdminOrOwner()
  }

  canDelete(): boolean {
    return this.canAccess() && this.isProjectAdminOrOwner()
  }
}
