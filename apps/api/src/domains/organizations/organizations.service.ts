import { Injectable, NotFoundException } from "@nestjs/common"
import { listRoleIds, unionRolePermissions } from "@/domains/memberships/membership-roles"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UsersService } from "@/domains/users/users.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationMembershipsService } from "./memberships/organization-memberships.service"
import { OrganizationModel } from "./organization.model"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationRepository } from "./organization.repository"

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizationMembershipsService: OrganizationMembershipsService,
    private readonly organizationRepository: OrganizationRepository,
    private readonly permissionService: PermissionService,
    private readonly usersService: UsersService,
  ) {}

  async listOrganizations(userId: string): Promise<OrganizationModel[]> {
    /**
     * {
     *    "ORG_XXXX": ['organization.read', 'organization.write'],
     *    "ORG_YYYY": ['organization.read', 'organization.write', 'project.create'],
     *  }
     */
    const permissionsByOrganizationId = await this.permissionService.listResourcePermissions(
      userId,
      "organization.read",
    )

    return this.organizationRepository.findByIds(permissionsByOrganizationId)
  }

  async createOrganization({
    userId,
    name,
  }: {
    userId: string
    name: string
  }): Promise<OrganizationModel> {
    if (!name || name.trim().length < 3) {
      throw new Error("Organization name must be at least 3 characters long")
    }

    const user = await this.usersService.findById(userId)
    if (!user) {
      throw new Error(`User with id ${userId} not found`)
    }

    const organization = await this.organizationRepository.createOrganization(name)

    const membership = await this.organizationMembershipsService.createOrganizationOwnerMembership({
      userId,
      organizationId: organization.id,
    })

    // the membership carries the RBAC roles it holds: ask RBAC what they grant
    const roleGrantsByRoleId = await this.permissionService.listRoleGrants(
      listRoleIds([membership]),
    )
    const permissions = unionRolePermissions(membership.roles, roleGrantsByRoleId)
    return new OrganizationModel(
      {
        id: organization.id,
        name: organization.name,
        createdAt: organization.createdAt.getTime(),
      },
      permissions,
    )
  }

  async updateOrganizationName({
    organizationId,
    name,
  }: {
    organizationId: string
    name: string
  }): Promise<void> {
    const updated = await this.organizationRepository.updateName(organizationId, name)
    if (!updated) {
      throw new NotFoundException(`Organization ${organizationId} not found`)
    }
  }
}
