import { ProjectScopedPolicy } from "@/common/policies/project-scoped-policy"
import type { ResourceLibrary } from "./resource-library.entity"

export class ResourceLibraryPolicy extends ProjectScopedPolicy<ResourceLibrary> {
  canList(): boolean {
    return this.canAccess() && this.isProjectAdminOrOwner()
  }

  canCreate(): boolean {
    return this.canList()
  }

  canUpdate(): boolean {
    return this.canAccess() && this.isProjectAdminOrOwner() && this.doesResourceBelongToScope()
  }

  canDelete(): boolean {
    return this.canUpdate()
  }
}
