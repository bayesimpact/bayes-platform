import type {
  BackofficeUserAgentMembershipDto,
  BackofficeUserOrganizationMembershipDto,
  BackofficeUserProjectMembershipDto,
  BackofficeUserReviewCampaignMembershipDto,
  FeatureFlagKey,
} from "@caseai-connect/api-contracts"
import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { In, type Repository } from "typeorm"
import { Agent } from "../agents/agent.entity"
import { AgentMembership } from "../agents/memberships/agent-membership.entity"
import { FeatureFlag } from "../feature-flags/feature-flag.entity"
import { UserMembership } from "../memberships/user-membership.entity"
import { OrganizationMembership } from "../organizations/memberships/organization-membership.entity"
import { Organization } from "../organizations/organization.entity"
import { ProjectMembership } from "../projects/memberships/project-membership.entity"
import { Project } from "../projects/project.entity"
import { User } from "../users/user.entity"

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
    @InjectRepository(Agent) private readonly agentRepository: Repository<Agent>,
    @InjectRepository(UserMembership)
    private readonly userMembershipRepository: Repository<UserMembership>,
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
    members: OrganizationMembership[]
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
      this.organizationMembershipRepository
        .createQueryBuilder("om")
        .select(["om.userId", "om.role"])
        .leftJoin("om.user", "user")
        .addSelect(["user.id", "user.email", "user.name"])
        .where("om.organizationId = :organizationId", { organizationId: targetOrganizationId })
        .orderBy("LOWER(user.email)", "ASC")
        .getMany(),
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
  }): Promise<{ agent: Agent; members: AgentMembership[] } | null> {
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

    const members = await this.agentMembershipRepository
      .createQueryBuilder("am")
      .select(["am.userId", "am.role"])
      .leftJoin("am.user", "user")
      .addSelect(["user.id", "user.email", "user.name"])
      .where("am.agentId = :agentId", { agentId: targetAgentId })
      .orderBy("LOWER(user.email)", "ASC")
      .getMany()

    return { agent, members }
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
    members: ProjectMembership[]
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
      this.projectMembershipRepository
        .createQueryBuilder("pm")
        .select(["pm.userId", "pm.role"])
        .leftJoin("pm.user", "user")
        .addSelect(["user.id", "user.email", "user.name"])
        .where("pm.projectId = :projectId", { projectId: targetProjectId })
        .orderBy("LOWER(user.email)", "ASC")
        .getMany(),
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
    organizationMemberships: BackofficeUserOrganizationMembershipDto[]
    projectMemberships: BackofficeUserProjectMembershipDto[]
    agentMemberships: BackofficeUserAgentMembershipDto[]
    reviewCampaignMemberships: BackofficeUserReviewCampaignMembershipDto[]
  } | null> {
    if (!canListAll) {
      const visibleUserIds = await this.findVisibleUserIdsForAdmin(requestingUserId)
      if (!visibleUserIds.has(targetUserId)) return null
    }

    const user = await this.userRepository.findOne({ where: { id: targetUserId } })
    if (!user) return null

    const [
      organizationMemberships,
      projectMemberships,
      agentMemberships,
      reviewCampaignMemberships,
    ] = await Promise.all([
      this.findUserOrganizationMemberships(targetUserId),
      this.findUserProjectMemberships(targetUserId),
      this.findUserAgentMemberships(targetUserId),
      this.findUserReviewCampaignMemberships(targetUserId),
    ])

    return {
      user,
      organizationMemberships,
      projectMemberships,
      agentMemberships,
      reviewCampaignMemberships,
    }
  }

  private async findUserOrganizationMemberships(
    userId: string,
  ): Promise<BackofficeUserOrganizationMembershipDto[]> {
    return this.userMembershipRepository
      .createQueryBuilder("membership")
      .innerJoin(
        "organization",
        "organization",
        "organization.id = membership.resourceId AND organization.deleted_at IS NULL",
      )
      .select("membership.resourceId", "organizationId")
      .addSelect("membership.role", "role")
      .addSelect("organization.name", "organizationName")
      .where("membership.userId = :userId", { userId })
      .andWhere("membership.resourceType = :resourceType", { resourceType: "organization" })
      .andWhere("membership.deletedAt IS NULL")
      .orderBy("LOWER(organization.name)", "ASC")
      .getRawMany<BackofficeUserOrganizationMembershipDto>()
  }

  private async findUserProjectMemberships(
    userId: string,
  ): Promise<BackofficeUserProjectMembershipDto[]> {
    return this.userMembershipRepository
      .createQueryBuilder("membership")
      .innerJoin(
        "project",
        "project",
        "project.id = membership.resourceId AND project.deleted_at IS NULL",
      )
      .select("membership.resourceId", "projectId")
      .addSelect("membership.role", "role")
      .addSelect("project.name", "projectName")
      .where("membership.userId = :userId", { userId })
      .andWhere("membership.resourceType = :resourceType", { resourceType: "project" })
      .andWhere("membership.deletedAt IS NULL")
      .orderBy("LOWER(project.name)", "ASC")
      .getRawMany<BackofficeUserProjectMembershipDto>()
  }

  private async findUserAgentMemberships(
    userId: string,
  ): Promise<BackofficeUserAgentMembershipDto[]> {
    return this.userMembershipRepository
      .createQueryBuilder("membership")
      .innerJoin("agent", "agent", "agent.id = membership.resourceId AND agent.deleted_at IS NULL")
      .select("membership.resourceId", "agentId")
      .addSelect("membership.role", "role")
      .addSelect("agent.name", "agentName")
      .where("membership.userId = :userId", { userId })
      .andWhere("membership.resourceType = :resourceType", { resourceType: "agent" })
      .andWhere("membership.deletedAt IS NULL")
      .orderBy("LOWER(agent.name)", "ASC")
      .getRawMany<BackofficeUserAgentMembershipDto>()
  }

  private async findUserReviewCampaignMemberships(
    userId: string,
  ): Promise<BackofficeUserReviewCampaignMembershipDto[]> {
    return this.userMembershipRepository
      .createQueryBuilder("membership")
      .innerJoin(
        "review_campaign",
        "campaign",
        "campaign.id = membership.resourceId AND campaign.deleted_at IS NULL",
      )
      .select("membership.resourceId", "campaignId")
      .addSelect("membership.role", "role")
      .addSelect("campaign.name", "campaignName")
      .where("membership.userId = :userId", { userId })
      .andWhere("membership.resourceType = :resourceType", { resourceType: "review_campaign" })
      .andWhere("membership.deletedAt IS NULL")
      .orderBy("LOWER(campaign.name)", "ASC")
      .addOrderBy("membership.role", "ASC")
      .getRawMany<BackofficeUserReviewCampaignMembershipDto>()
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
