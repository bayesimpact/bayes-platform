import { Injectable } from "@nestjs/common"
import { In, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import { Project } from "@/domains/projects/project.entity"
import { PROJECT_READ_PERMISSION } from "@/domains/rbac/rbac.constants"
import { Organization } from "./organization.entity"
import type { OrganizationModel, OrganizationProjectModel } from "./organization.model"

const PROJECT_RESOURCE_TYPE = "project" as const

type OrganizationPermissionRow = { organizationId: string; permissionKey: string }

@Injectable()
export class OrganizationRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async findAccessibleForUser(userId: string): Promise<OrganizationModel[]> {
    const permissionsByOrganizationId = await this.loadPermissionsByOrganizationId(userId)
    const organizationIds = [...permissionsByOrganizationId.keys()]
    if (organizationIds.length === 0) {
      return []
    }

    const [organizations, projectsByOrganizationId] = await Promise.all([
      this.loadOrganizations(organizationIds),
      this.loadProjectsByOrganizationId(userId, organizationIds, permissionsByOrganizationId),
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

  private async loadPermissionsByOrganizationId(userId: string): Promise<Map<string, string[]>> {
    const rows: OrganizationPermissionRow[] = await this.transactionService.getManager().query(
      `SELECT membership.resource_id AS "organizationId", permission.key AS "permissionKey"
         FROM user_membership membership
         INNER JOIN role_permission role_permission ON role_permission.role_id = membership.role_id
         INNER JOIN permission ON permission.id = role_permission.permission_id
         WHERE membership.user_id = $1
           AND membership.resource_type = 'organization'
           AND membership.resource_id IS NOT NULL
           AND membership.role_id IS NOT NULL
           AND membership.deleted_at IS NULL
         ORDER BY membership.resource_id, permission.key`,
      [userId],
    )

    const permissionsByOrganizationId = new Map<string, string[]>()
    for (const row of rows) {
      const organizationPermissions = permissionsByOrganizationId.get(row.organizationId) ?? []
      organizationPermissions.push(row.permissionKey)
      permissionsByOrganizationId.set(row.organizationId, organizationPermissions)
    }

    return permissionsByOrganizationId
  }

  private async loadOrganizations(organizationIds: string[]): Promise<Organization[]> {
    return this.organizationRepo().find({
      where: { id: In(organizationIds) },
      order: { createdAt: "DESC" },
    })
  }

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

    const projects = [
      ...(await this.findProjectsByOrganizationIds(organizationIdsWithProjectRead)),
      ...(await this.findMemberProjectsByOrganizationIds(userId, membershipOnlyOrganizationIds)),
    ]

    return this.groupProjectsByOrganizationId(organizationIds, projects)
  }

  private async findProjectsByOrganizationIds(organizationIds: string[]): Promise<Project[]> {
    if (organizationIds.length === 0) {
      return []
    }

    return this.projectRepo().find({
      where: { organizationId: In(organizationIds) },
      relations: { featureFlags: true },
      order: { createdAt: "DESC" },
    })
  }

  private async findMemberProjectsByOrganizationIds(
    userId: string,
    organizationIds: string[],
  ): Promise<Project[]> {
    if (organizationIds.length === 0) {
      return []
    }

    const memberships = await this.userMembershipRepo().find({
      where: { userId, resourceType: PROJECT_RESOURCE_TYPE },
    })
    const projectIds = memberships
      .map((membership) => membership.resourceId)
      .filter((resourceId): resourceId is string => resourceId !== null)
    if (projectIds.length === 0) {
      return []
    }

    return this.projectRepo().find({
      where: { organizationId: In(organizationIds), id: In(projectIds) },
      relations: { featureFlags: true },
      order: { createdAt: "DESC" },
    })
  }

  private groupProjectsByOrganizationId(
    organizationIds: string[],
    projects: Project[],
  ): Map<string, OrganizationProjectModel[]> {
    const projectsByOrganizationId = new Map<string, OrganizationProjectModel[]>(
      organizationIds.map((organizationId) => [organizationId, []]),
    )

    for (const project of projects) {
      projectsByOrganizationId.get(project.organizationId)?.push(this.toProjectModel(project))
    }

    return projectsByOrganizationId
  }

  private toProjectModel(project: Project): OrganizationProjectModel {
    return {
      id: project.id,
      name: project.name,
      featureFlags: (project.featureFlags ?? [])
        .filter((featureFlag) => featureFlag.enabled)
        .map((featureFlag) => featureFlag.featureFlagKey),
    }
  }

  private organizationRepo(): Repository<Organization> {
    return this.transactionService.getManager().getRepository(Organization)
  }

  private userMembershipRepo(): Repository<UserMembership> {
    return this.transactionService.getManager().getRepository(UserMembership)
  }

  private projectRepo(): Repository<Project> {
    return this.transactionService.getManager().getRepository(Project)
  }
}
