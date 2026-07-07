import { BasePolicy } from "@/common/policies/base-policy"
import type { OrganizationMembershipContextModel } from "../organizations/memberships/organization-membership.model"
import type { ProjectMembershipFixture } from "./memberships/project-membership.types"
import type { Project } from "./project.entity"

export class ProjectPolicy extends BasePolicy<Project> {
  protected readonly projectMembership?: ProjectMembershipFixture

  constructor(
    protected readonly context: {
      organizationMembership: OrganizationMembershipContextModel
      projectMembership?: ProjectMembershipFixture
    },
    protected readonly entity?: Project,
  ) {
    super(context.organizationMembership, entity)
    this.projectMembership = context.projectMembership
  }

  canList(): boolean {
    return this.canAccessOrganization()
  }

  canCreate(): boolean {
    return this.canAccessOrganization() && this.isOrganizationAdminOrOwner()
  }

  canUpdate(): boolean {
    return (
      this.doesResourceBelongToOrganization() &&
      this.isProjectAdminOrOwner() &&
      this.canAccessProject()
    )
  }

  canDelete(): boolean {
    return this.canUpdate()
  }

  protected canAccessProject(): boolean {
    return this.isMemberOfProject()
  }

  protected isMemberOfProject(): boolean {
    return this.projectMembership?.projectId === this.entity?.id
  }

  protected isProjectOwner(): boolean {
    return this.projectMembership?.role === "owner"
  }

  protected isProjectAdmin(): boolean {
    return this.projectMembership?.role === "admin"
  }

  protected isProjectAdminOrOwner(): boolean {
    return this.isProjectAdmin() || this.isProjectOwner()
  }
}
