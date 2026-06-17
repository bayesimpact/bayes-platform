import type { FeatureFlagKey } from "@caseai-connect/api-contracts"
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource, In, type Repository } from "typeorm"
import { AgentMembership } from "../agents/memberships/agent-membership.entity"
import { FeatureFlag } from "../feature-flags/feature-flag.entity"
import { OrganizationMembership } from "../organizations/memberships/organization-membership.entity"
import { Organization } from "../organizations/organization.entity"
import { ProjectMembership } from "../projects/memberships/project-membership.entity"
import { Project } from "../projects/project.entity"
import { User } from "../users/user.entity"
import type { BackofficeOrganizationView } from "./backoffice.helpers"

const adminRoles = In(["admin", "owner"])

@Injectable()
export class BackofficeService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(Project) private readonly projectRepository: Repository<Project>,
    @InjectRepository(FeatureFlag)
    private readonly featureFlagRepository: Repository<FeatureFlag>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(OrganizationMembership)
    private readonly organizationMembershipRepository: Repository<OrganizationMembership>,
    @InjectRepository(ProjectMembership)
    private readonly projectMembershipRepository: Repository<ProjectMembership>,
    @InjectRepository(AgentMembership)
    private readonly agentMembershipRepository: Repository<AgentMembership>,
    @InjectDataSource() readonly _dataSource: DataSource,
  ) {}

  async listOrganizationsWithProjects({
    canListAll,
    userId,
    page,
    limit,
    search,
  }: {
    canListAll: boolean
    userId: string
    page: number
    limit: number
    search?: string
  }): Promise<{ organizations: BackofficeOrganizationView[]; total: number }> {
    let visibleOrganizationIds: Set<string> | null = null
    let visibleProjectIds: Set<string> | null = null
    if (!canListAll) {
      const adminScope = await this.findAdminOrganizationAndProjectIds(userId)
      visibleOrganizationIds = adminScope.organizationIds
      visibleProjectIds = adminScope.projectIds
      if (visibleOrganizationIds.size === 0 && visibleProjectIds.size === 0) {
        return { organizations: [], total: 0 }
      }
    }

    const idsQuery = this.organizationRepository
      .createQueryBuilder("organization")
      .select("organization.id", "id")
      .orderBy("LOWER(organization.name)", "ASC")

    if (visibleOrganizationIds !== null && visibleProjectIds !== null) {
      const visibleOrganizationIdList = Array.from(visibleOrganizationIds)
      const visibleProjectIdList = Array.from(visibleProjectIds)
      if (visibleProjectIdList.length === 0) {
        idsQuery.andWhere("organization.id IN (:...visibleOrganizationIds)", {
          visibleOrganizationIds: visibleOrganizationIdList,
        })
      } else if (visibleOrganizationIdList.length === 0) {
        idsQuery.andWhere(
          `EXISTS (
            SELECT 1 FROM "project" "scoped_project"
            WHERE "scoped_project"."organization_id" = "organization"."id"
              AND "scoped_project"."id" IN (:...visibleProjectIds)
          )`,
          { visibleProjectIds: visibleProjectIdList },
        )
      } else {
        idsQuery.andWhere(
          `(
            "organization"."id" IN (:...visibleOrganizationIds)
            OR EXISTS (
              SELECT 1 FROM "project" "scoped_project"
              WHERE "scoped_project"."organization_id" = "organization"."id"
                AND "scoped_project"."id" IN (:...visibleProjectIds)
            )
          )`,
          {
            visibleOrganizationIds: visibleOrganizationIdList,
            visibleProjectIds: visibleProjectIdList,
          },
        )
      }
    }

    const trimmedSearch = search?.trim()
    if (trimmedSearch) {
      const searchPattern = `%${trimmedSearch.toLowerCase()}%`
      idsQuery.andWhere(
        `(
          LOWER("organization"."name") LIKE :searchPattern
          OR EXISTS (
            SELECT 1 FROM "project" "searched_project"
            WHERE "searched_project"."organization_id" = "organization"."id"
              AND LOWER("searched_project"."name") LIKE :searchPattern
          )
        )`,
        { searchPattern },
      )
    }

    const total = await idsQuery.getCount()
    const idRows = await idsQuery
      .offset(page * limit)
      .limit(limit)
      .getRawMany<{ id: string }>()
    const paginatedIds = idRows.map((row) => row.id)

    if (paginatedIds.length === 0) {
      return { organizations: [], total }
    }

    const organizations = await this.organizationRepository.find({
      where: { id: In(paginatedIds) },
      relations: {
        projects: { featureFlags: true },
      },
    })

    const organizationsById = new Map(
      organizations.map((organization) => [organization.id, organization]),
    )
    const orderedOrganizations = paginatedIds
      .map((id) => organizationsById.get(id))
      .filter((organization): organization is Organization => organization !== undefined)

    const scopedOrganizations =
      visibleOrganizationIds !== null && visibleProjectIds !== null
        ? this.scopeOrganizationProjects(
            orderedOrganizations,
            visibleOrganizationIds,
            visibleProjectIds,
          )
        : orderedOrganizations

    return {
      organizations: scopedOrganizations.map((organization) => ({
        ...organization,
        projects: organization.projects ?? [],
      })),
      total,
    }
  }

  private async findAdminOrganizationAndProjectIds(
    userId: string,
  ): Promise<{ organizationIds: Set<string>; projectIds: Set<string> }> {
    const [adminOrganizationMemberships, adminProjectMemberships] = await Promise.all([
      this.organizationMembershipRepository.find({
        where: { userId, role: adminRoles },
      }),
      this.projectMembershipRepository.find({
        where: { userId, role: adminRoles },
      }),
    ])
    return {
      organizationIds: new Set(
        adminOrganizationMemberships.map((membership) => membership.organizationId),
      ),
      projectIds: new Set(adminProjectMemberships.map((membership) => membership.projectId)),
    }
  }

  private scopeOrganizationProjects(
    organizations: Organization[],
    visibleOrganizationIds: Set<string>,
    visibleProjectIds: Set<string>,
  ): Organization[] {
    return organizations.map((organization) => {
      const isAdminOfOrganization = visibleOrganizationIds.has(organization.id)
      const visibleProjects = (organization.projects ?? []).filter(
        (project) => isAdminOfOrganization || visibleProjectIds.has(project.id),
      )
      return { ...organization, projects: visibleProjects }
    })
  }

  async listUsers({
    canListAll,
    userId,
    page,
    limit,
    search,
  }: {
    canListAll: boolean
    userId: string
    page: number
    limit: number
    search?: string
  }): Promise<{ users: User[]; total: number }> {
    const qb = this.userRepository.createQueryBuilder("user").orderBy("LOWER(user.email)", "ASC")

    if (!canListAll) {
      const visibleUserIds = await this.findVisibleUserIdsForAdmin(userId)
      if (visibleUserIds.size === 0) {
        return { users: [], total: 0 }
      }
      qb.andWhere("user.id IN (:...visibleUserIds)", {
        visibleUserIds: Array.from(visibleUserIds),
      })
    }

    const trimmedSearch = search?.trim()
    if (trimmedSearch) {
      const searchPattern = `%${trimmedSearch.toLowerCase()}%`
      qb.andWhere(
        `(
          LOWER("user"."email") LIKE :searchPattern
          OR LOWER(COALESCE("user"."name", '')) LIKE :searchPattern
        )`,
        { searchPattern },
      )
    }

    const [users, total] = await qb
      .skip(page * limit)
      .take(limit)
      .getManyAndCount()

    return { users, total }
  }

  async getUserDetail({
    canListAll,
    requestingUserId,
    targetUserId,
  }: {
    canListAll: boolean
    requestingUserId: string
    targetUserId: string
  }): Promise<{
    user: User
    organizationMemberships: OrganizationMembership[]
    agentMemberships: AgentMembership[]
  } | null> {
    if (!canListAll) {
      const visibleUserIds = await this.findVisibleUserIdsForAdmin(requestingUserId)
      if (!visibleUserIds.has(targetUserId)) return null
    }

    const user = await this.userRepository.findOne({ where: { id: targetUserId } })
    if (!user) return null

    const [organizationMemberships, agentMemberships] = await Promise.all([
      this.organizationMembershipRepository.find({
        where: { userId: targetUserId },
        relations: { organization: true },
        order: { organization: { name: "ASC" } },
      }),
      this.agentMembershipRepository.find({
        where: { userId: targetUserId },
        relations: { agent: true },
        order: { agent: { name: "ASC" } },
      }),
    ])

    return { user, organizationMemberships, agentMemberships }
  }

  private async findVisibleUserIdsForAdmin(userId: string): Promise<Set<string>> {
    const [adminOrganizationMemberships, adminProjectMemberships, adminAgentMemberships] =
      await Promise.all([
        this.organizationMembershipRepository.find({ where: { userId, role: adminRoles } }),
        this.projectMembershipRepository.find({ where: { userId, role: adminRoles } }),
        this.agentMembershipRepository.find({ where: { userId, role: adminRoles } }),
      ])

    const adminOrganizationIds = adminOrganizationMemberships.map(
      (membership) => membership.organizationId,
    )
    const adminProjectIds = adminProjectMemberships.map((membership) => membership.projectId)
    const adminAgentIds = adminAgentMemberships.map((membership) => membership.agentId)

    const [sharedOrganizationMemberships, sharedProjectMemberships, sharedAgentMemberships] =
      await Promise.all([
        adminOrganizationIds.length === 0
          ? []
          : this.organizationMembershipRepository.find({
              where: { organizationId: In(adminOrganizationIds) },
            }),
        adminProjectIds.length === 0
          ? []
          : this.projectMembershipRepository.find({
              where: { projectId: In(adminProjectIds) },
            }),
        adminAgentIds.length === 0
          ? []
          : this.agentMembershipRepository.find({
              where: { agentId: In(adminAgentIds) },
            }),
      ])

    const visibleUserIds = new Set<string>([userId])
    for (const membership of sharedOrganizationMemberships) {
      visibleUserIds.add(membership.userId)
    }
    for (const membership of sharedProjectMemberships) {
      visibleUserIds.add(membership.userId)
    }
    for (const membership of sharedAgentMemberships) {
      visibleUserIds.add(membership.userId)
    }
    return visibleUserIds
  }

  async addFeatureFlag({
    projectId,
    featureFlagKey,
    canListAll,
    userId,
  }: {
    projectId: string
    featureFlagKey: FeatureFlagKey
    canListAll: boolean
    userId: string
  }): Promise<void> {
    await this.assertProjectEditable({ canListAll, userId, projectId })

    const existing = await this.featureFlagRepository.findOne({
      where: { projectId, featureFlagKey },
    })
    if (existing) {
      if (!existing.enabled) {
        existing.enabled = true
        await this.featureFlagRepository.save(existing)
      }
      return
    }
    const flag = this.featureFlagRepository.create({
      projectId,
      featureFlagKey,
      enabled: true,
    })
    await this.featureFlagRepository.save(flag)
  }

  async removeFeatureFlag({
    projectId,
    featureFlagKey,
    canListAll,
    userId,
  }: {
    projectId: string
    featureFlagKey: FeatureFlagKey
    canListAll: boolean
    userId: string
  }): Promise<void> {
    await this.assertProjectEditable({ canListAll, userId, projectId })
    await this.featureFlagRepository.delete({ projectId, featureFlagKey })
  }

  private async assertProjectEditable({
    canListAll,
    userId,
    projectId,
  }: {
    canListAll: boolean
    userId: string
    projectId: string
  }): Promise<void> {
    const project = await this.projectRepository.findOne({ where: { id: projectId } })
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`)
    }
    if (canListAll) {
      return
    }

    const projectMembership = await this.projectMembershipRepository.findOne({
      where: { userId, projectId, role: adminRoles },
    })

    if (!projectMembership) {
      throw new ForbiddenException(`User does not have admin access to project ${projectId}`)
    }
  }
}
