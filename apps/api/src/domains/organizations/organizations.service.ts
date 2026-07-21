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
    // 1. Ask RBAC which organizations the user belongs to.
    const organizationIds = await this.permissionService.listResourceIds(userId, "organization")
    if (organizationIds.length === 0) {
      return []
    }

    // 2. Fetch in parallel: per-org permissions, project membership IDs, and org entities.
    const [permissionsByOrganizationId, projectIds, organizations] = await Promise.all([
      this.permissionService.listPermissionsForResourceIds(userId, "organization", organizationIds),
      this.permissionService.listResourceIds(userId, "project"),
      this.organizationRepository.findByIds(organizationIds),
    ])

    // 3. Split orgs into two buckets based on `project.read`:
    //    - owners/admins (project.read) → see every project in the org
    //    - members without it → see only their project memberships (see ADR 0013)
    const organizationIdsWithProjectRead = organizationIds.filter((organizationId) =>
      permissionsByOrganizationId.get(organizationId)?.includes(PROJECT_READ_PERMISSION),
    )
    const membershipOnlyOrganizationIds = organizationIds.filter(
      (organizationId) => !organizationIdsWithProjectRead.includes(organizationId),
    )

    // 4. Hydrate projects for each bucket in parallel.
    const [allProjectsForPrivilegedOrgs, membershipProjects] = await Promise.all([
      this.organizationRepository.findProjectsByOrganizationIds(organizationIdsWithProjectRead),
      this.organizationRepository.findProjectsByIdsInOrganizations({
        projectIds,
        organizationIds: membershipOnlyOrganizationIds,
      }),
    ])

    // 5. Group projects under their org and assemble the response DTOs.
    const projectsByOrganizationId = this.groupProjectsByOrganizationId(organizationIds, [
      ...allProjectsForPrivilegedOrgs,
      ...membershipProjects,
    ])

    return organizations
      .map((organization) => ({
        id: organization.id,
        name: organization.name,
        permissions: permissionsByOrganizationId.get(organization.id) ?? [],
        projects: projectsByOrganizationId.get(organization.id) ?? [],
      }))
      .filter((organization) => organization.permissions.length > 0)
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
