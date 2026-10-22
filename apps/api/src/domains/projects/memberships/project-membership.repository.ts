import { Injectable } from "@nestjs/common"
import { In, type Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import {
  groupMembershipRows,
  type MembershipRowGroup,
  resourceIdOf,
} from "@/domains/memberships/membership-roles"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import { Project } from "@/domains/projects/project.entity"
import { requireRoleId } from "@/domains/rbac/resolve-role-id"
import { HUMAN_USER_TYPE_FILTER } from "@/domains/users/service-user.helpers"
import type { ProjectMembershipModel } from "./project-membership.model"

const PROJECT_RESOURCE_TYPE = "project" as const
const MEMBERSHIP_RELATIONS = { user: true, rbacRole: true } as const

/**
 * Repository for project memberships.
 *
 * Reads and writes the unified `user_membership` table with `resourceType = 'project'`. A person
 * holds one row per role on a project; reads group them into one model per person.
 */
@Injectable()
export class ProjectMembershipRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async findAllByProject(projectId: string): Promise<ProjectMembershipModel[]> {
    const rows = await this.userMembershipRepo().find({
      where: {
        resourceType: PROJECT_RESOURCE_TYPE,
        resourceId: projectId,
        user: HUMAN_USER_TYPE_FILTER,
      },
      relations: MEMBERSHIP_RELATIONS,
    })
    const project = await this.projectRepo().findOneOrFail({ where: { id: projectId } })
    return this.newestFirst(groupMembershipRows(rows)).map((group) => this.toModel(group, project))
  }

  async findAllByUser(userId: string): Promise<ProjectMembershipModel[]> {
    const rows = await this.userMembershipRepo().find({
      where: { userId, resourceType: PROJECT_RESOURCE_TYPE },
      relations: MEMBERSHIP_RELATIONS,
    })
    return this.toModels(this.newestFirst(groupMembershipRows(rows)))
  }

  async findAllByProjectIds(projectIds: string[]): Promise<ProjectMembershipModel[]> {
    if (projectIds.length === 0) return []

    const rows = await this.userMembershipRepo().find({
      where: {
        resourceType: PROJECT_RESOURCE_TYPE,
        resourceId: In(projectIds),
        user: HUMAN_USER_TYPE_FILTER,
      },
      relations: MEMBERSHIP_RELATIONS,
    })
    return this.toModels(groupMembershipRows(rows))
  }

  async findByUserAndProject({
    userId,
    projectId,
  }: {
    userId: string
    projectId: string
  }): Promise<ProjectMembershipModel | null> {
    const rows = await this.userMembershipRepo().find({
      where: { userId, resourceType: PROJECT_RESOURCE_TYPE, resourceId: projectId },
      relations: MEMBERSHIP_RELATIONS,
    })
    const [group] = groupMembershipRows(rows)
    if (!group) return null

    const project = await this.projectRepo().findOne({ where: { id: projectId } })
    if (!project) return null

    return this.toModel(group, project)
  }

  /** The human members among the users, one model per person; users who are not members are left out. */
  async findAllByUsersAndProject({
    userIds,
    projectId,
  }: {
    userIds: string[]
    projectId: string
  }): Promise<ProjectMembershipModel[]> {
    if (userIds.length === 0) return []

    const rows = await this.userMembershipRepo().find({
      where: {
        userId: In(userIds),
        resourceType: PROJECT_RESOURCE_TYPE,
        resourceId: projectId,
        user: HUMAN_USER_TYPE_FILTER,
      },
      relations: MEMBERSHIP_RELATIONS,
    })
    const project = await this.projectRepo().findOneOrFail({ where: { id: projectId } })
    return groupMembershipRows(rows).map((group) => this.toModel(group, project))
  }

  async findAnyByUserAndOrganization({
    userId,
    organizationId,
  }: {
    userId: string
    organizationId: string
  }): Promise<ProjectMembershipModel | null> {
    const row = await this.userMembershipRepo()
      .createQueryBuilder("membership")
      .innerJoin(Project, "project", "project.id = membership.resource_id")
      .where("membership.userId = :userId", { userId })
      .andWhere("membership.resourceType = :resourceType", { resourceType: PROJECT_RESOURCE_TYPE })
      .andWhere("project.organizationId = :organizationId", { organizationId })
      .orderBy("membership.createdAt", "ASC")
      .getOne()
    if (!row?.resourceId) return null

    return this.findByUserAndProject({ userId, projectId: row.resourceId })
  }

  /** The people who hold at least one of the roles on the project. */
  async findUserIdsHoldingRoles({
    projectId,
    roleKeys,
  }: {
    projectId: string
    roleKeys: string[]
  }): Promise<string[]> {
    const rows = await this.userMembershipRepo().find({
      where: {
        resourceType: PROJECT_RESOURCE_TYPE,
        resourceId: projectId,
        rbacRole: { key: In(roleKeys) },
      },
      select: { userId: true },
    })
    return [...new Set(rows.map((row) => row.userId))]
  }

  /** Gives the person the role on the project. Does nothing when they already hold it. */
  async addRole({
    userId,
    projectId,
    roleKey,
  }: {
    userId: string
    projectId: string
    roleKey: string
  }): Promise<void> {
    const roleId = await requireRoleId(this.transactionService.getManager(), roleKey)
    await this.userMembershipRepo()
      .createQueryBuilder()
      .insert()
      .values({ userId, resourceType: PROJECT_RESOURCE_TYPE, resourceId: projectId, roleId })
      .orIgnore()
      .execute()
  }

  /**
   * Moves the person from one role to another on the project, keeping the row (and so its id)
   * when they did not hold the new role yet. Does nothing when they do not hold the old one.
   */
  async switchRole({
    userId,
    projectId,
    fromRoleKey,
    toRoleKey,
  }: {
    userId: string
    projectId: string
    fromRoleKey: string
    toRoleKey: string
  }): Promise<void> {
    const manager = this.transactionService.getManager()
    const fromRoleId = await requireRoleId(manager, fromRoleKey)
    const toRoleId = await requireRoleId(manager, toRoleKey)
    const where = { userId, resourceType: PROJECT_RESOURCE_TYPE, resourceId: projectId }

    const holdsTarget = await this.userMembershipRepo().exists({
      where: { ...where, roleId: toRoleId },
    })
    if (holdsTarget) {
      await this.userMembershipRepo().delete({ ...where, roleId: fromRoleId })
      return
    }
    await this.userMembershipRepo().update({ ...where, roleId: fromRoleId }, { roleId: toRoleId })
  }

  /** Takes the role from the person on the project. Does nothing when they do not hold it. */
  async removeRole({
    userId,
    projectId,
    roleKey,
  }: {
    userId: string
    projectId: string
    roleKey: string
  }): Promise<void> {
    const roleId = await requireRoleId(this.transactionService.getManager(), roleKey)
    await this.userMembershipRepo().delete({
      userId,
      resourceType: PROJECT_RESOURCE_TYPE,
      resourceId: projectId,
      roleId,
    })
  }

  async countHolders({ projectId, roleKey }: { projectId: string; roleKey: string }) {
    return this.userMembershipRepo().count({
      where: {
        resourceType: PROJECT_RESOURCE_TYPE,
        resourceId: projectId,
        rbacRole: { key: roleKey },
      },
    })
  }

  async createMembership({
    userId,
    projectId,
    roleKey,
  }: {
    userId: string
    projectId: string
    roleKey: string
  }): Promise<ProjectMembershipModel> {
    await this.addRole({ userId, projectId, roleKey })
    const membership = await this.findByUserAndProject({ userId, projectId })
    if (!membership) throw new Error(`Project ${projectId} not found`)
    return membership
  }

  /** Removes every role the person holds on the project. */
  async deleteAllForUser({ userId, projectId }: { userId: string; projectId: string }) {
    await this.userMembershipRepo().delete({
      userId,
      resourceType: PROJECT_RESOURCE_TYPE,
      resourceId: projectId,
    })
  }

  /**
   * Removes the user's tester and reviewer rows on the project's review campaigns. A campaign role
   * gives keys on the campaign's project, so removing someone from the project removes those too.
   */
  async deleteReviewCampaignMembershipsForUserInProject({
    userId,
    projectId,
  }: {
    userId: string
    projectId: string
  }): Promise<void> {
    await this.transactionService.getManager().query(
      `DELETE FROM user_membership AS membership
       USING review_campaign
       WHERE membership.user_id = $1
         AND membership.resource_type = 'review_campaign'
         AND membership.resource_id = review_campaign.id
         AND review_campaign.project_id = $2`,
      [userId, projectId],
    )
  }

  async softDeleteAllByProject(projectId: string): Promise<void> {
    await this.userMembershipRepo().softDelete({
      resourceType: PROJECT_RESOURCE_TYPE,
      resourceId: projectId,
    })
  }

  private userMembershipRepo(): Repository<UserMembership> {
    return this.transactionService.getManager().getRepository(UserMembership)
  }

  private projectRepo(): Repository<Project> {
    return this.transactionService.getManager().getRepository(Project)
  }

  private newestFirst(groups: MembershipRowGroup[]): MembershipRowGroup[] {
    return [...groups].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
  }

  private async toModels(groups: MembershipRowGroup[]): Promise<ProjectMembershipModel[]> {
    if (groups.length === 0) return []

    const projectIds = [...new Set(groups.map((group) => resourceIdOf(group)))]
    const projects = await this.projectRepo().find({ where: { id: In(projectIds) } })
    const projectById = new Map(projects.map((project) => [project.id, project]))

    return groups.flatMap((group) => {
      const project = projectById.get(resourceIdOf(group))
      return project ? [this.toModel(group, project)] : []
    })
  }

  private toModel(group: MembershipRowGroup, project: Project): ProjectMembershipModel {
    return {
      userId: group.userId,
      projectId: resourceIdOf(group),
      roles: group.roles,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      user: group.user,
      project,
    }
  }
}
