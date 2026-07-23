import type { OrganizationPermission } from "@caseai-connect/api-contracts"
import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"
import { User } from "@/domains/users/user.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationMembershipsService } from "./memberships/organization-memberships.service"
import { Organization } from "./organization.entity"
import { toModel } from "./organization.helpers"
import type { OrganizationModel } from "./organization.model"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationRepository } from "./organization.repository"

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationEntityRepository: Repository<Organization>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly organizationMembershipsService: OrganizationMembershipsService,
    private readonly organizationRepository: OrganizationRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async listOrganizations(userId: string): Promise<OrganizationModel[]> {
    const permissionsByOrganizationId = await this.permissionService.listResourcePermissions(
      userId,
      "organization",
    )

    const organizations = await this.organizationRepository.findByIds([
      ...permissionsByOrganizationId.keys(),
    ])

    return organizations.map((organization) =>
      toModel(
        organization,
        (permissionsByOrganizationId.get(organization.id) ?? []) as OrganizationPermission[],
      ),
    )
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

    const user = await this.userRepository.findOne({ where: { id: userId } })
    if (!user) {
      throw new Error(`User with id ${userId} not found`)
    }

    const organization = this.organizationEntityRepository.create({ name })
    const savedOrganization = await this.organizationEntityRepository.save(organization)

    const membership = await this.organizationMembershipsService.createOrganizationOwnerMembership({
      userId: user.id,
      organizationId: savedOrganization.id,
    })

    // the membership carries the RBAC role it was created with: ask RBAC what that role grants
    const permissions = membership.roleId
      ? await this.permissionService.listPermissionsForRole(membership.roleId)
      : []
    return toModel(savedOrganization, permissions as OrganizationPermission[])
  }

  async updateOrganizationName({
    organizationId,
    name,
  }: {
    organizationId: string
    name: string
  }): Promise<void> {
    const organization = await this.organizationEntityRepository.findOne({
      where: { id: organizationId },
    })
    if (!organization) {
      throw new NotFoundException(`Organization ${organizationId} not found`)
    }

    organization.name = name
    await this.organizationEntityRepository.save(organization)
  }
}
