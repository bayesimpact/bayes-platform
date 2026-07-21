import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"
import { PROJECT_READ_PERMISSION } from "@/domains/rbac/rbac.constants"
import { User } from "@/domains/users/user.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationMembershipsService } from "./memberships/organization-memberships.service"
import { Organization } from "./organization.entity"
import type { OrganizationModel, OrganizationProjectModel } from "./organization.model"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationRepository } from "./organization.repository"

type AccessibleOrganization = {
  organization: Organization
  permissions: string[]
}

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

  async getUserOrganizations(userId: string): Promise<Organization[]> {
    return this.organizationMembershipsService.listOrganizationsForUser(userId)
  }

  async listUserOrganizations(userId: string): Promise<OrganizationModel[]> {
    const accessibleOrganizations = await this.listAccessibleOrganizations(userId)
    if (accessibleOrganizations.length === 0) {
      return []
    }

    const permissionsByOrganizationId = new Map(
      accessibleOrganizations.map(({ organization, permissions }) => [
        organization.id,
        permissions,
      ]),
    )
    const organizationIds = accessibleOrganizations.map(({ organization }) => organization.id)

    const projectsByOrganizationId = await this.loadProjectsByOrganizationId(
      userId,
      organizationIds,
      permissionsByOrganizationId,
    )

    return accessibleOrganizations.map(({ organization, permissions }) => ({
      id: organization.id,
      name: organization.name,
      permissions,
      projects: projectsByOrganizationId.get(organization.id) ?? [],
    }))
  }

  /**
   * Returns organizations the user can access, paired with their per-org permissions.
   * Only orgs where the user has at least one permission are included.
   */
  private async listAccessibleOrganizations(userId: string): Promise<AccessibleOrganization[]> {
    const organizationIds = await this.permissionService.listResourceIds(userId, "organization")
    if (organizationIds.length === 0) {
      return []
    }

    const [permissionsByOrganizationId, organizations] = await Promise.all([
      this.permissionService.listPermissionsForResourceIds(userId, "organization", organizationIds),
      this.organizationRepository.findByIds(organizationIds),
    ])

    return organizations
      .map((organization) => ({
        organization,
        permissions: permissionsByOrganizationId.get(organization.id) ?? [],
      }))
      .filter(({ permissions }) => permissions.length > 0)
  }

  /**
   * Loads projects grouped by organization, using the two-bucket strategy (see ADR 0013):
   * - orgs where user has `project.read` → all projects in the org
   * - orgs without it → only projects the user has a direct membership on
   */
  private async loadProjectsByOrganizationId(
    userId: string,
    organizationIds: string[],
    permissionsByOrganizationId: Map<string, string[]>,
  ): Promise<Map<string, OrganizationProjectModel[]>> {
    const organizationIdsWithProjectRead = organizationIds.filter((organizationId) =>
      permissionsByOrganizationId.get(organizationId)?.includes(PROJECT_READ_PERMISSION),
    )
    const membershipOnlyOrganizationIds = organizationIds.filter(
      (organizationId) => !organizationIdsWithProjectRead.includes(organizationId),
    )

    const allProjectsForPrivilegedOrgs =
      await this.organizationRepository.findProjectsByOrganizationIds(
        organizationIdsWithProjectRead,
      )

    let membershipProjects: Awaited<
      ReturnType<OrganizationRepository["findProjectsByIdsInOrganizations"]>
    > = []
    if (membershipOnlyOrganizationIds.length > 0) {
      const projectIds = await this.permissionService.listResourceIds(userId, "project")
      membershipProjects = await this.organizationRepository.findProjectsByIdsInOrganizations({
        projectIds,
        organizationIds: membershipOnlyOrganizationIds,
      })
    }

    return this.groupProjectsByOrganizationId(organizationIds, [
      ...allProjectsForPrivilegedOrgs,
      ...membershipProjects,
    ])
  }

  async createOrganization({
    userId,
    name,
  }: {
    userId: string
    name: string
  }): Promise<Organization> {
    if (!name || name.trim().length < 3) {
      throw new Error("Organization name must be at least 3 characters long")
    }

    const user = await this.userRepository.findOne({ where: { id: userId } })
    if (!user) {
      throw new Error(`User with id ${userId} not found`)
    }

    const organization = this.organizationEntityRepository.create({ name })
    const savedOrganization = await this.organizationEntityRepository.save(organization)

    await this.organizationMembershipsService.createOrganizationOwnerMembership({
      userId: user.id,
      organizationId: savedOrganization.id,
    })

    return savedOrganization
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

  private groupProjectsByOrganizationId(
    organizationIds: string[],
    projects: Parameters<OrganizationRepository["toProjectModel"]>[0][],
  ): Map<string, OrganizationProjectModel[]> {
    const projectsByOrganizationId = new Map<string, OrganizationProjectModel[]>(
      organizationIds.map((organizationId) => [organizationId, []]),
    )

    for (const project of projects) {
      projectsByOrganizationId
        .get(project.organizationId)
        ?.push(this.organizationRepository.toProjectModel(project))
    }

    return projectsByOrganizationId
  }
}
