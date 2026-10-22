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
import { hasRole, listRoleIds } from "@/domains/memberships/membership-roles"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"
import type { RoleGrant } from "@/domains/rbac/permission.types"
import { PROJECT_ROLES } from "@/domains/rbac/rbac.constants"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UserRepository } from "@/domains/users/user.repository"
import type { ProjectMembershipModel } from "./project-membership.model"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipRepository } from "./project-membership.repository"
import type { EditableProjectMembershipRole } from "./project-membership.types"

const EDITABLE_ROLES: EditableProjectMembershipRole[] = ["admin", "member"]

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
  async listMemberAgents(params: { projectId: string; userId: string }) {
    const entries = await this.agentMembershipsService.listProjectMemberAgents(params)
    const roleGrantsByRoleId = await this.permissionService.listRoleGrants(
      listRoleIds(entries.flatMap(({ membership }) => (membership ? [membership] : []))),
    )
    return { entries, roleGrantsByRoleId }
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
   * Switches another member of the project between admin and member, and moves their agent
   * memberships along: admin on every agent when promoted, member instead of admin when demoted.
   * Their other roles stay, `project_owner` included. Nobody changes their own roles.
   */
  async updateProjectMembershipRole({
    callerUserId,
    memberUserId,
    projectId,
    role,
  }: {
    callerUserId: string
    memberUserId: string
    projectId: string
    role: EditableProjectMembershipRole
  }): Promise<{ membership: ProjectMembershipModel; roleGrantsByRoleId: Map<string, RoleGrant> }> {
    if (!EDITABLE_ROLES.includes(role)) {
      throw new BadRequestException("Role must be admin or member")
    }

    const membership = await this.transactionService.run(async () => {
      const existing = await this.projectMembershipRepository.findByUserAndProject({
        userId: memberUserId,
        projectId,
      })
      if (!existing) throw new NotFoundException()

      if (existing.userId === callerUserId) {
        throw new ForbiddenException("Cannot change your own role")
      }

      const targetRoleKey = PROJECT_ROLES[role]
      const otherRoleKey = role === "admin" ? PROJECT_ROLES.member : PROJECT_ROLES.admin
      const holdsTarget = hasRole(existing, targetRoleKey)
      const holdsOther = hasRole(existing, otherRoleKey)
      if (holdsTarget && !holdsOther) return existing

      const userId = existing.userId
      if (holdsOther) {
        await this.projectMembershipRepository.switchRole({
          userId,
          projectId,
          fromRoleKey: otherRoleKey,
          toRoleKey: targetRoleKey,
        })
      } else {
        await this.projectMembershipRepository.addRole({
          userId,
          projectId,
          roleKey: targetRoleKey,
        })
      }
      if (role === "admin") {
        await this.agentMembershipsService.createAdminAgentMembershipsForUserInProject({
          userId,
          projectId,
        })
      } else {
        await this.agentMembershipsService.demoteAdminAgentMembershipsForUserInProject({
          userId,
          projectId,
        })
      }

      const updated = await this.projectMembershipRepository.findByUserAndProject({
        userId,
        projectId,
      })
      if (!updated) throw new NotFoundException()
      return updated
    })

    const roleGrantsByRoleId = await this.permissionService.listRoleGrants(
      listRoleIds([membership]),
    )
    return { membership, roleGrantsByRoleId }
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

      if (membership.userId === callerUserId) {
        throw new ForbiddenException("Cannot remove yourself from the project")
      }

      if (hasRole(membership, PROJECT_ROLES.owner)) {
        const ownerCount = await this.projectMembershipRepository.countHolders({
          projectId,
          roleKey: PROJECT_ROLES.owner,
        })
        if (ownerCount <= 1) {
          throw new ForbiddenException("Cannot remove the last owner of the project")
        }
      }

      await this.agentMembershipsService.deleteAgentMembershipsForUserInProject({
        userId: membership.userId,
        projectId,
      })

      await this.projectMembershipRepository.deleteReviewCampaignMembershipsForUserInProject({
        userId: membership.userId,
        projectId,
      })

      await this.projectMembershipRepository.deleteAllForUser({
        userId: membership.userId,
        projectId,
      })

      await this.userRepository.deleteIfUnusedPlaceholder({ userId: membership.userId })
    })
  }
}
