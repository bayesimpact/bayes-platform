import type { FeatureFlagKey } from "@caseai-connect/api-contracts"
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { In, type Repository } from "typeorm"
import type { AgentMembershipModel } from "@/domains/agents/memberships/agent-membership.model"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipsService } from "@/domains/agents/memberships/agent-memberships.service"
import type { OrganizationMembershipModel } from "@/domains/organizations/memberships/organization-membership.model"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationMembershipsService } from "@/domains/organizations/memberships/organization-memberships.service"
import type { ProjectMembershipModel } from "@/domains/projects/memberships/project-membership.model"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipsService } from "@/domains/projects/memberships/project-memberships.service"
import { Agent } from "../agents/agent.entity"
import { FeatureFlag } from "../feature-flags/feature-flag.entity"
import { Organization } from "../organizations/organization.entity"
import { Project } from "../projects/project.entity"
import { User } from "../users/user.entity"

function sortMembershipsByUserEmail<TMembership extends { user: { email: string } }>(
  memberships: TMembership[],
): TMembership[] {
  return [...memberships].sort((left, right) =>
    left.user.email.localeCompare(right.user.email, undefined, { sensitivity: "base" }),
  )
}

function sortOrganizationMembershipsByOrganizationName(
  memberships: OrganizationMembershipModel[],
): OrganizationMembershipModel[] {
  return [...memberships].sort((left, right) =>
    left.organization.name.localeCompare(right.organization.name, undefined, {
      sensitivity: "base",
    }),
  )
}

function sortProjectMembershipsByProjectName(
  memberships: ProjectMembershipModel[],
): ProjectMembershipModel[] {
  return [...memberships].sort((left, right) =>
    left.project.name.localeCompare(right.project.name, undefined, { sensitivity: "base" }),
  )
}

function sortAgentMembershipsByAgentName(
  memberships: AgentMembershipModel[],
): AgentMembershipModel[] {
  return [...memberships].sort((left, right) =>
    left.agent.name.localeCompare(right.agent.name, undefined, { sensitivity: "base" }),
  )
}

@Injectable()
export class BackofficeService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(Project) private readonly projectRepository: Repository<Project>,
    @InjectRepository(FeatureFlag)
    private readonly featureFlagRepository: Repository<FeatureFlag>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Agent) private readonly agentRepository: Repository<Agent>,
    private readonly organizationMembershipsService: OrganizationMembershipsService,
    private readonly projectMembershipsService: ProjectMembershipsService,
    private readonly agentMembershipsService: AgentMembershipsService,
  ) {}

  async listOrganizations({
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
  }): Promise<{ organizations: Organization[]; total: number }> {
    const qb = this.organizationRepository
      .createQueryBuilder("organization")
      .orderBy("LOWER(organization.name)", "ASC")

    if (!canListAll) {
      const { organizationIds, projectIds } = await this.findAdminOrganizationAndProjectIds(userId)
      if (organizationIds.size === 0 && projectIds.size === 0) {
        return { organizations: [], total: 0 }
      }
      if (organizationIds.size > 0 && projectIds.size > 0) {
        qb.andWhere(
          `(
            organization.id IN (:...organizationIds)
            OR EXISTS (
              SELECT 1 FROM "project" "p"
              WHERE "p"."organization_id" = "organization"."id"
                AND "p"."id" IN (:...projectIds)
            )
          )`,
          {
            organizationIds: Array.from(organizationIds),
            projectIds: Array.from(projectIds),
          },
        )
      } else if (organizationIds.size > 0) {
        qb.andWhere("organization.id IN (:...organizationIds)", {
          organizationIds: Array.from(organizationIds),
        })
      } else {
        qb.andWhere(
          `EXISTS (
            SELECT 1 FROM "project" "p"
            WHERE "p"."organization_id" = "organization"."id"
              AND "p"."id" IN (:...projectIds)
          )`,
          { projectIds: Array.from(projectIds) },
        )
      }
    }

    const trimmedSearch = search?.trim()
    if (trimmedSearch) {
      const searchPattern = `%${trimmedSearch.toLowerCase()}%`
      qb.andWhere(
        "(LOWER(organization.name) LIKE :searchPattern OR CAST(organization.id AS TEXT) LIKE :searchPattern)",
        { searchPattern },
      )
    }

    const [organizations, total] = await qb
      .skip(page * limit)
      .take(limit)
      .getManyAndCount()
    return { organizations, total }
  }

  async getOrganizationDetail({
    canListAll,
    requestingUserId,
    targetOrganizationId,
  }: {
    canListAll: boolean
    requestingUserId: string
    targetOrganizationId: string
  }): Promise<{
    organization: Organization
    members: OrganizationMembershipModel[]
    projects: Project[]
  } | null> {
    if (!canListAll) {
      const { organizationIds, projectIds } =
        await this.findAdminOrganizationAndProjectIds(requestingUserId)
      const hasDirectAccess = organizationIds.has(targetOrganizationId)
      if (!hasDirectAccess) {
        const hasProjectAccess =
          projectIds.size > 0
            ? await this.projectRepository.existsBy({
                organizationId: targetOrganizationId,
                id: In(Array.from(projectIds)),
              })
            : false
        if (!hasProjectAccess) return null
      }
    }

    const organization = await this.organizationRepository.findOne({
      where: { id: targetOrganizationId },
    })
    if (!organization) return null

    const [members, rawProjects] = await Promise.all([
      this.organizationMembershipsService.listOrganizationMemberships(targetOrganizationId),
      this.projectRepository
        .createQueryBuilder("project")
        .select(["project.id", "project.name"])
        .where("project.organizationId = :organizationId", { organizationId: targetOrganizationId })
        .orderBy("project.name", "ASC")
        .getMany(),
    ])

    const projects = await this.attachFeatureFlagsToProjects(rawProjects)

    return { organization, members, projects }
  }

  async listAgents({
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
  }): Promise<{ agents: Agent[]; total: number }> {
    const qb = this.agentRepository
      .createQueryBuilder("agent")
      .leftJoin("agent.project", "project")
      .addSelect(["project.id", "project.name"])
      .orderBy("agent.name", "ASC")

    if (!canListAll) {
      const { organizationIds, projectIds } = await this.findAdminOrganizationAndProjectIds(userId)
      if (organizationIds.size === 0 && projectIds.size === 0) {
        return { agents: [], total: 0 }
      }
      if (organizationIds.size > 0 && projectIds.size > 0) {
        qb.andWhere(
          `(agent.projectId IN (:...projectIds) OR project.organizationId IN (:...organizationIds))`,
          {
            projectIds: Array.from(projectIds),
            organizationIds: Array.from(organizationIds),
          },
        )
      } else if (organizationIds.size > 0) {
        qb.andWhere("project.organizationId IN (:...organizationIds)", {
          organizationIds: Array.from(organizationIds),
        })
      } else {
        qb.andWhere("agent.projectId IN (:...projectIds)", {
          projectIds: Array.from(projectIds),
        })
      }
    }

    const trimmedSearch = search?.trim()
    if (trimmedSearch) {
      const searchPattern = `%${trimmedSearch.toLowerCase()}%`
      qb.andWhere(
        "(LOWER(agent.name) LIKE :searchPattern OR LOWER(project.name) LIKE :searchPattern OR CAST(agent.id AS TEXT) LIKE :searchPattern)",
        { searchPattern },
      )
    }

    const [agents, total] = await qb
      .skip(page * limit)
      .take(limit)
      .getManyAndCount()
    return { agents, total }
  }

  async getAgentDetail({
    canListAll,
    requestingUserId,
    targetAgentId,
  }: {
    canListAll: boolean
    requestingUserId: string
    targetAgentId: string
  }): Promise<{ agent: Agent; members: AgentMembershipModel[] } | null> {
    const agent = await this.agentRepository
      .createQueryBuilder("agent")
      .select(["agent.id", "agent.name", "agent.createdAt"])
      .leftJoin("agent.project", "project")
      .addSelect(["project.id", "project.name", "project.organizationId"])
      .leftJoin("project.organization", "organization")
      .addSelect(["organization.id", "organization.name"])
      .where("agent.id = :agentId", { agentId: targetAgentId })
      .getOne()

    if (!agent) return null

    if (!canListAll) {
      const { organizationIds, projectIds } =
        await this.findAdminOrganizationAndProjectIds(requestingUserId)
      const projectId = agent.project?.id
      const organizationId = agent.project?.organization?.id
      const hasAccess =
        (projectId !== undefined && projectIds.has(projectId)) ||
        (organizationId !== undefined && organizationIds.has(organizationId))
      if (!hasAccess) return null
    }

    const members = sortMembershipsByUserEmail(
      await this.agentMembershipsService.listAgentMemberships(targetAgentId),
    )

    return { agent, members }
  }

  private async findAdminOrganizationAndProjectIds(
    userId: string,
  ): Promise<{ organizationIds: Set<string>; projectIds: Set<string> }> {
    const [adminOrganizationMemberships, adminProjectMemberships] = await Promise.all([
      this.organizationMembershipsService.listAdminAndOwnerMembershipsForUser(userId),
      this.projectMembershipsService.listAdminAndOwnerMembershipsForUser(userId),
    ])
    return {
      organizationIds: new Set(
        adminOrganizationMemberships.map((membership) => membership.organizationId),
      ),
      projectIds: new Set(adminProjectMemberships.map((membership) => membership.projectId)),
    }
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
          OR CAST("user"."id" AS TEXT) LIKE :searchPattern
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

  async listProjects({
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
  }): Promise<{ projects: Project[]; total: number }> {
    const qb = this.projectRepository
      .createQueryBuilder("project")
      .leftJoin("project.organization", "org")
      .addSelect(["org.id", "org.name"])
      .orderBy("project.name", "ASC")

    if (!canListAll) {
      const { organizationIds, projectIds } = await this.findAdminOrganizationAndProjectIds(userId)
      if (organizationIds.size === 0 && projectIds.size === 0) {
        return { projects: [], total: 0 }
      }
      if (organizationIds.size > 0 && projectIds.size > 0) {
        qb.andWhere(
          "(project.organizationId IN (:...organizationIds) OR project.id IN (:...projectIds))",
          {
            organizationIds: Array.from(organizationIds),
            projectIds: Array.from(projectIds),
          },
        )
      } else if (organizationIds.size > 0) {
        qb.andWhere("project.organizationId IN (:...organizationIds)", {
          organizationIds: Array.from(organizationIds),
        })
      } else {
        qb.andWhere("project.id IN (:...projectIds)", {
          projectIds: Array.from(projectIds),
        })
      }
    }

    const trimmedSearch = search?.trim()
    if (trimmedSearch) {
      const searchPattern = `%${trimmedSearch.toLowerCase()}%`
      qb.andWhere(
        `(
          LOWER(project.name) LIKE :searchPattern
          OR LOWER(org.name) LIKE :searchPattern
          OR CAST(project.id AS TEXT) LIKE :searchPattern
        )`,
        { searchPattern },
      )
    }

    const [rawProjects, total] = await qb
      .skip(page * limit)
      .take(limit)
      .getManyAndCount()

    const projects = await this.attachFeatureFlagsToProjects(rawProjects)

    return { projects, total }
  }

  private async attachFeatureFlagsToProjects(projects: Project[]): Promise<Project[]> {
    if (projects.length === 0) return projects
    const projectIds = projects.map((project) => project.id)
    const featureFlags = await this.featureFlagRepository.find({
      where: { projectId: In(projectIds) },
      select: ["projectId", "featureFlagKey", "enabled"],
    })
    const featureFlagsByProjectId = new Map<string, typeof featureFlags>()
    for (const featureFlag of featureFlags) {
      const existing = featureFlagsByProjectId.get(featureFlag.projectId) ?? []
      existing.push(featureFlag)
      featureFlagsByProjectId.set(featureFlag.projectId, existing)
    }
    return projects.map((project) => ({
      ...project,
      featureFlags: featureFlagsByProjectId.get(project.id) ?? [],
    }))
  }

  async getProjectDetail({
    canListAll,
    requestingUserId,
    targetProjectId,
  }: {
    canListAll: boolean
    requestingUserId: string
    targetProjectId: string
  }): Promise<{
    project: Project
    members: ProjectMembershipModel[]
    agents: Agent[]
  } | null> {
    if (!canListAll) {
      const { organizationIds, projectIds } =
        await this.findAdminOrganizationAndProjectIds(requestingUserId)
      const targetProject = await this.projectRepository.findOne({
        where: { id: targetProjectId },
        select: ["id", "organizationId"],
      })
      if (!targetProject) return null
      const canAccess =
        organizationIds.has(targetProject.organizationId) || projectIds.has(targetProjectId)
      if (!canAccess) return null
    }

    const project = await this.projectRepository
      .createQueryBuilder("project")
      .leftJoin("project.organization", "org")
      .addSelect(["org.id", "org.name"])
      .leftJoinAndSelect("project.featureFlags", "featureFlag")
      .where("project.id = :id", { id: targetProjectId })
      .getOne()
    if (!project) return null

    const [members, agents] = await Promise.all([
      sortMembershipsByUserEmail(
        await this.projectMembershipsService.listProjectMemberships(targetProjectId),
      ),
      this.agentRepository
        .createQueryBuilder("agent")
        .select(["agent.id", "agent.name"])
        .where("agent.projectId = :projectId", { projectId: targetProjectId })
        .orderBy("LOWER(agent.name)", "ASC")
        .getMany(),
    ])

    return { project, members, agents }
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
    organizationMemberships: OrganizationMembershipModel[]
    projectMemberships: ProjectMembershipModel[]
    agentMemberships: AgentMembershipModel[]
  } | null> {
    if (!canListAll) {
      const visibleUserIds = await this.findVisibleUserIdsForAdmin(requestingUserId)
      if (!visibleUserIds.has(targetUserId)) return null
    }

    const user = await this.userRepository.findOne({ where: { id: targetUserId } })
    if (!user) return null

    const [organizationMemberships, projectMemberships, agentMemberships] = await Promise.all([
      this.organizationMembershipsService
        .listMembershipsForUser(targetUserId)
        .then(sortOrganizationMembershipsByOrganizationName),
      this.projectMembershipsService
        .listMembershipsForUser(targetUserId)
        .then(sortProjectMembershipsByProjectName),
      this.agentMembershipsService
        .listMembershipsForUser(targetUserId)
        .then(sortAgentMembershipsByAgentName),
    ])

    return { user, organizationMemberships, projectMemberships, agentMemberships }
  }

  private async findVisibleUserIdsForAdmin(userId: string): Promise<Set<string>> {
    const [adminOrganizationMemberships, adminProjectMemberships, adminAgentMemberships] =
      await Promise.all([
        this.organizationMembershipsService.listAdminAndOwnerMembershipsForUser(userId),
        this.projectMembershipsService.listAdminAndOwnerMembershipsForUser(userId),
        this.agentMembershipsService.listAdminAndOwnerMembershipsForUser(userId),
      ])

    const adminOrganizationIds = adminOrganizationMemberships.map(
      (membership) => membership.organizationId,
    )
    const adminProjectIds = adminProjectMemberships.map((membership) => membership.projectId)
    const adminAgentIds = adminAgentMemberships.map((membership) => membership.agentId)

    const [sharedOrganizationMemberships, sharedProjectMemberships, sharedAgentMemberships] =
      await Promise.all([
        this.organizationMembershipsService.listMembershipsByOrganizationIds(adminOrganizationIds),
        this.projectMembershipsService.listMembershipsByProjectIds(adminProjectIds),
        this.agentMembershipsService.listMembershipsByAgentIds(adminAgentIds),
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

    const projectMembership = await this.projectMembershipsService.findProjectMembership({
      userId,
      projectId,
    })

    if (
      !projectMembership ||
      (projectMembership.role !== "admin" && projectMembership.role !== "owner")
    ) {
      throw new ForbiddenException(`User does not have admin access to project ${projectId}`)
    }
  }
}
