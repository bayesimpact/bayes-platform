import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipsService } from "@/domains/agents/memberships/agent-memberships.service"
import {
  hasRole,
  listRoleIds,
  type MembershipRole,
  unionRolePermissions,
} from "@/domains/memberships/membership-roles"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"
import type { RoleGrant } from "@/domains/rbac/permission.types"
import {
  AGENT_CONVERSATION_REVIEWER_ROLE,
  AGENT_MEMBER_UPDATE_PERMISSION,
  PROJECT_MEMBER_UPDATE_PERMISSION,
  PROJECT_REVIEW_CAMPAIGN_MEMBER_INVITE_PERMISSION,
  PROJECT_ROLES,
} from "@/domains/rbac/rbac.constants"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UserRepository } from "@/domains/users/user.repository"
import type { MemberRoles, ProjectMembershipModel } from "./project-membership.model"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipRepository } from "./project-membership.repository"

/** The project roles that make their holder admin of every agent of the project. */
const AGENT_MANAGING_ROLE_KEYS: string[] = [PROJECT_ROLES.owner, PROJECT_ROLES.admin]

@Injectable()
export class ProjectMembershipsService {
  constructor(
    private readonly projectMembershipRepository: ProjectMembershipRepository,
    private readonly transactionService: TransactionService,
    private readonly agentMembershipsService: AgentMembershipsService,
    private readonly userRepository: UserRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async listProjectMemberships(projectId: string): Promise<ProjectMembershipModel[]> {
    return this.projectMembershipRepository.findAllByProject(projectId)
  }

  /** Every member of the project, with the permissions each of their roles grants. */
  async listProjectMembershipsWithRoleGrants(projectId: string): Promise<{
    memberships: ProjectMembershipModel[]
    roleGrantsByRoleId: Map<string, RoleGrant>
  }> {
    const memberships = await this.projectMembershipRepository.findAllByProject(projectId)
    const roleGrantsByRoleId = await this.permissionService.listRoleGrants(listRoleIds(memberships))
    return { memberships, roleGrantsByRoleId }
  }

  async listMembershipsForUser(userId: string): Promise<ProjectMembershipModel[]> {
    return this.projectMembershipRepository.findAllByUser(userId)
  }

  async listMembershipsByProjectIds(projectIds: string[]): Promise<ProjectMembershipModel[]> {
    return this.projectMembershipRepository.findAllByProjectIds(projectIds)
  }

  async findProjectMembership({
    userId,
    projectId,
  }: {
    userId: string
    projectId: string
  }): Promise<ProjectMembershipModel | null> {
    return this.projectMembershipRepository.findByUserAndProject({ userId, projectId })
  }

  async findProjectMembershipInOrganization({
    userId,
    organizationId,
  }: {
    userId: string
    organizationId: string
  }): Promise<ProjectMembershipModel | null> {
    return this.projectMembershipRepository.findAnyByUserAndOrganization({
      userId,
      organizationId,
    })
  }

  /** Every agent of the project, with the user's membership and the permissions its roles grant. */
  /**
   * A member's roles on the project, each of its agents and each of its review campaigns, the
   * permissions those roles grant, and whether the viewer may change them on each resource.
   */
  async getMemberRoles({
    viewerUserId,
    memberUserId,
    projectId,
  }: {
    viewerUserId: string
    memberUserId: string
    projectId: string
  }): Promise<MemberRoles> {
    const membership = await this.projectMembershipRepository.findByUserAndProject({
      userId: memberUserId,
      projectId,
    })
    if (!membership) throw new NotFoundException()

    const [agentEntries, campaignEntries, catalog] = await Promise.all([
      this.agentMembershipsService.listProjectMemberAgents({ projectId, userId: memberUserId }),
      this.projectMembershipRepository.findCampaignRolesInProject({
        userId: memberUserId,
        projectId,
      }),
      this.permissionService.getCatalog(),
    ])
    const agentRoles = agentEntries.map(({ membership: agentMembership }) =>
      agentMembership ? agentMembership.roles : [],
    )
    const roleGrantsByRoleId = await this.permissionService.listRoleGrants([
      ...listRoleIds([membership]),
      ...listRoleIds(agentRoles.map((roles) => ({ roles }))),
      ...listRoleIds(campaignEntries),
    ])
    const permissionsOf = (roles: MembershipRole[]) =>
      unionRolePermissions(roles, roleGrantsByRoleId)

    const [canManageProject, canManageCampaigns, ...canManageAgents] = await Promise.all([
      this.permissionService.has(viewerUserId, PROJECT_MEMBER_UPDATE_PERMISSION, {
        type: "project",
        id: projectId,
      }),
      this.permissionService.has(viewerUserId, PROJECT_REVIEW_CAMPAIGN_MEMBER_INVITE_PERMISSION, {
        type: "project",
        id: projectId,
      }),
      ...agentEntries.map(({ agent }) =>
        this.permissionService.has(viewerUserId, AGENT_MEMBER_UPDATE_PERMISSION, {
          type: "agent",
          id: agent.id,
        }),
      ),
    ])

    const catalogRoles = (scopeType: string, excludedKeys: string[] = []) =>
      catalog.roles
        .filter((role) => role.scopeType === scopeType && !excludedKeys.includes(role.key))
        .map((role) => ({ key: role.key, name: role.name }))

    return {
      membership,
      roleGrantsByRoleId,
      workspace: {
        kind: "project",
        resourceId: projectId,
        resourceName: membership.project.name,
        detail: null,
        roles: membership.roles,
        permissions: permissionsOf(membership.roles),
        canManage: canManageProject,
      },
      agents: agentEntries.map(({ agent }, index) => {
        const roles = agentRoles[index] ?? []
        return {
          kind: "agent",
          resourceId: agent.id,
          resourceName: agent.name,
          detail: agent.type,
          roles,
          permissions: permissionsOf(roles),
          canManage: canManageAgents[index] ?? false,
        }
      }),
      campaigns: campaignEntries.map((campaign) => ({
        kind: "review_campaign",
        resourceId: campaign.campaignId,
        resourceName: campaign.campaignName,
        detail: campaign.campaignStatus,
        roles: campaign.roles,
        permissions: permissionsOf(campaign.roles),
        canManage: canManageCampaigns && campaign.campaignStatus !== "closed",
      })),
      assignableRoles: {
        project: catalogRoles("project"),
        // The conversation reviewer role is granted in the backoffice only.
        agent: catalogRoles("agent", [AGENT_CONVERSATION_REVIEWER_ROLE]),
        review_campaign: catalogRoles("review_campaign"),
      },
    }
  }

  async createProjectOwnerMembership({
    projectId,
    userId,
  }: {
    projectId: string
    userId: string
  }): Promise<ProjectMembershipModel> {
    return this.transactionService.run(() =>
      this.projectMembershipRepository.createMembership({
        projectId,
        userId,
        roleKey: PROJECT_ROLES.owner,
      }),
    )
  }

  /**
   * Ensures the given user holds `project_admin` on the project, with admin on every agent.
   *
   * - If they already hold it, returns null (no-op).
   * - If they hold `project_member`, switches it to admin and syncs their agent memberships.
   * - Otherwise adds an admin row next to their other roles (an owner keeps ownership), and
   *   returns the membership when they had none before.
   *
   * Owns its transaction via TransactionService.run(). Can safely be called
   * from within another run() context — the "join or start" propagation means
   * it will participate in the outer transaction rather than starting a new one.
   */
  async upsertProjectAdminMembership({
    projectId,
    userId,
  }: {
    projectId: string
    userId: string
  }): Promise<ProjectMembershipModel | null> {
    return this.transactionService.run(async () => {
      const existing = await this.projectMembershipRepository.findByUserAndProject({
        userId,
        projectId,
      })

      if (existing && hasRole(existing, PROJECT_ROLES.admin)) return null

      if (existing && hasRole(existing, PROJECT_ROLES.member)) {
        await this.projectMembershipRepository.switchRole({
          userId,
          projectId,
          fromRoleKey: PROJECT_ROLES.member,
          toRoleKey: PROJECT_ROLES.admin,
        })
      } else {
        await this.projectMembershipRepository.addRole({
          userId,
          projectId,
          roleKey: PROJECT_ROLES.admin,
        })
      }
      await this.agentMembershipsService.createAdminAgentMembershipsForUserInProject({
        userId,
        projectId,
      })

      if (existing) return null
      return this.projectMembershipRepository.findByUserAndProject({ userId, projectId })
    })
  }

  /**
   * Ensures the user has a role on the project: any role counts, since each one grants what a
   * member gets. Returns the existing membership when present, otherwise creates a member one.
   */
  async upsertProjectMemberMembership({
    projectId,
    userId,
  }: {
    projectId: string
    userId: string
  }): Promise<ProjectMembershipModel | null> {
    return this.transactionService.run(async () => {
      const existing = await this.projectMembershipRepository.findByUserAndProject({
        userId,
        projectId,
      })
      if (existing) return existing

      return this.projectMembershipRepository.createMembership({
        userId,
        projectId,
        roleKey: PROJECT_ROLES.member,
      })
    })
  }

  /**
   * Soft-deletes all project memberships for the given project.
   * Joins an outer transaction when called inside TransactionService.run().
   */
  async deleteMembership({ projectId }: { projectId: string }): Promise<void> {
    await this.projectMembershipRepository.softDeleteAllByProject(projectId)
  }

  /**
   * Removes a person from the project: every role they hold on it, their agent memberships in the
   * project and their tester and reviewer roles on its review campaigns. Nobody removes
   * themselves, and the project keeps at least one `project_owner`.
   * If the user was added by email and never signed in, also removes the
   * account once it has no membership left.
   */
  async removeProjectMembership({
    callerUserId,
    memberUserId,
    projectId,
  }: {
    callerUserId: string
    memberUserId: string
    projectId: string
  }): Promise<void> {
    return this.transactionService.run(async () => {
      const membership = await this.projectMembershipRepository.findByUserAndProject({
        userId: memberUserId,
        projectId,
      })
      if (!membership) return

      await this.removeMembers({ callerUserId, projectId, memberships: [membership] })
    })
  }

  /**
   * Removes several people from the project, all or nothing, like `removeProjectMembership` for
   * each. Every user must be a member.
   */
  async removeProjectMemberships({
    callerUserId,
    memberUserIds,
    projectId,
  }: {
    callerUserId: string
    memberUserIds: string[]
    projectId: string
  }): Promise<void> {
    return this.transactionService.run(async () => {
      const memberships = await this.findMembers({ userIds: memberUserIds, projectId })
      await this.removeMembers({ callerUserId, projectId, memberships })
    })
  }

  /**
   * The roles a member can be given on the project, in catalog order: the `project` roles of the
   * RBAC catalog. App install roles stay out of it.
   */
  async listAssignableRoles(): Promise<{ key: string; name: string }[]> {
    const { roles } = await this.permissionService.getCatalog()
    return roles
      .filter((role) => role.scopeType === "project")
      .map((role) => ({ key: role.key, name: role.name }))
  }

  /**
   * Gives the roles to several members of the project, all or nothing. Nobody changes their own
   * roles. `project_owner` and `project_admin` also make the member admin of every agent of the
   * project, as for an invited admin.
   */
  async addRolesToMembers({
    callerUserId,
    memberUserIds,
    projectId,
    roleKeys,
  }: {
    callerUserId: string
    memberUserIds: string[]
    projectId: string
    roleKeys: string[]
  }): Promise<{
    memberships: ProjectMembershipModel[]
    roleGrantsByRoleId: Map<string, RoleGrant>
  }> {
    await this.assertAssignable(roleKeys)
    if (memberUserIds.includes(callerUserId)) {
      throw new ForbiddenException("Cannot change your own role")
    }

    const memberships = await this.transactionService.run(async () => {
      await this.findMembers({ userIds: memberUserIds, projectId })
      const managesAgents = roleKeys.some((roleKey) => AGENT_MANAGING_ROLE_KEYS.includes(roleKey))

      for (const userId of memberUserIds) {
        for (const roleKey of roleKeys) {
          await this.projectMembershipRepository.addRole({ userId, projectId, roleKey })
        }
        if (managesAgents) {
          await this.agentMembershipsService.createAdminAgentMembershipsForUserInProject({
            userId,
            projectId,
          })
        }
      }

      return this.findMembers({ userIds: memberUserIds, projectId })
    })

    const roleGrantsByRoleId = await this.permissionService.listRoleGrants(listRoleIds(memberships))
    return { memberships, roleGrantsByRoleId }
  }

  /**
   * Takes one role from a member. Nobody changes their own roles, a member keeps at least one
   * role (removing the last one is removing the member), and the project keeps an owner. Losing
   * the last of `project_owner` and `project_admin` turns their admin agent memberships into
   * member ones.
   */
  async removeRoleFromMember({
    callerUserId,
    memberUserId,
    projectId,
    roleKey,
  }: {
    callerUserId: string
    memberUserId: string
    projectId: string
    roleKey: string
  }): Promise<{ membership: ProjectMembershipModel; roleGrantsByRoleId: Map<string, RoleGrant> }> {
    if (memberUserId === callerUserId) {
      throw new ForbiddenException("Cannot change your own role")
    }

    const membership = await this.transactionService.run(async () => {
      const existing = await this.projectMembershipRepository.findByUserAndProject({
        userId: memberUserId,
        projectId,
      })
      if (!existing) throw new NotFoundException()
      if (!hasRole(existing, roleKey)) {
        throw new NotFoundException(`The member does not hold ${roleKey}`)
      }
      if (existing.roles.length === 1) {
        throw new BadRequestException("A member keeps at least one role: remove the member instead")
      }
      if (roleKey === PROJECT_ROLES.owner) {
        await this.assertOwnersRemain({ projectId, removedOwnerCount: 1 })
      }

      await this.projectMembershipRepository.removeRole({
        userId: memberUserId,
        projectId,
        roleKey,
      })

      const updated = await this.projectMembershipRepository.findByUserAndProject({
        userId: memberUserId,
        projectId,
      })
      if (!updated) throw new NotFoundException()
      const stillManagesAgents = AGENT_MANAGING_ROLE_KEYS.some((key) => hasRole(updated, key))
      if (AGENT_MANAGING_ROLE_KEYS.includes(roleKey) && !stillManagesAgents) {
        await this.agentMembershipsService.demoteAdminAgentMembershipsForUserInProject({
          userId: memberUserId,
          projectId,
        })
      }
      return updated
    })

    const roleGrantsByRoleId = await this.permissionService.listRoleGrants(
      listRoleIds([membership]),
    )
    return { membership, roleGrantsByRoleId }
  }

  /** The members among the users, or a 404 when one of them is not a member of the project. */
  private async findMembers({
    userIds,
    projectId,
  }: {
    userIds: string[]
    projectId: string
  }): Promise<ProjectMembershipModel[]> {
    const memberships = await this.projectMembershipRepository.findAllByUsersAndProject({
      userIds,
      projectId,
    })
    if (memberships.length !== new Set(userIds).size) {
      throw new NotFoundException("Some of the users are not members of the project")
    }
    return memberships
  }

  private async assertAssignable(roleKeys: string[]): Promise<void> {
    const assignableKeys = new Set((await this.listAssignableRoles()).map((role) => role.key))
    const unknownKeys = roleKeys.filter((roleKey) => !assignableKeys.has(roleKey))
    if (unknownKeys.length > 0) {
      throw new BadRequestException(`Not a workspace role: ${unknownKeys.join(", ")}`)
    }
  }

  private async assertOwnersRemain({
    projectId,
    removedOwnerCount,
  }: {
    projectId: string
    removedOwnerCount: number
  }): Promise<void> {
    const ownerCount = await this.projectMembershipRepository.countHolders({
      projectId,
      roleKey: PROJECT_ROLES.owner,
    })
    if (ownerCount - removedOwnerCount < 1) {
      throw new ForbiddenException("Cannot remove the last owner of the project")
    }
  }

  /** Call inside a transaction. */
  private async removeMembers({
    callerUserId,
    projectId,
    memberships,
  }: {
    callerUserId: string
    projectId: string
    memberships: ProjectMembershipModel[]
  }): Promise<void> {
    if (memberships.some((membership) => membership.userId === callerUserId)) {
      throw new ForbiddenException("Cannot remove yourself from the project")
    }
    const removedOwnerCount = memberships.filter((membership) =>
      hasRole(membership, PROJECT_ROLES.owner),
    ).length
    if (removedOwnerCount > 0) {
      await this.assertOwnersRemain({ projectId, removedOwnerCount })
    }

    for (const { userId } of memberships) {
      await this.agentMembershipsService.deleteAgentMembershipsForUserInProject({
        userId,
        projectId,
      })
      await this.projectMembershipRepository.deleteReviewCampaignMembershipsForUserInProject({
        userId,
        projectId,
      })
      await this.projectMembershipRepository.deleteAllForUser({ userId, projectId })
      await this.userRepository.deleteIfUnusedPlaceholder({ userId })
    }
  }
}
