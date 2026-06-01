import { ProjectScopedPolicy } from "@/common/policies/project-scoped-policy"

export class ProjectAgentCategoriesPolicy extends ProjectScopedPolicy<never> {
  canCreate(): boolean {
    return this.canAccess() && this.isProjectAdminOrOwner()
  }

  canDelete(): boolean {
    return this.canAccess() && this.isProjectAdminOrOwner()
  }
}
