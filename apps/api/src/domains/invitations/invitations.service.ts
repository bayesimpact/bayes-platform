import { randomUUID } from "node:crypto"
import type { InvitationDto } from "@caseai-connect/api-contracts"
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { MailerService } from "@/common/mailer/mailer.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { getAppPublicUrl } from "@/config/app-public-url"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { PermissionService } from "@/domains/rbac/permission.service"
import { AGENT_MEMBER_INVITE_PERMISSION, PROJECT_ROLES } from "@/domains/rbac/rbac.constants"
import type { ReviewCampaignMembershipRole } from "@/domains/review-campaigns/review-campaigns.types"
import { isServiceIdentity } from "@/domains/users/service-user.helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UserRepository } from "@/domains/users/user.repository"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UsersService } from "@/domains/users/users.service"
import type { Invitation } from "./invitation.entity"
import { toInvitationDto } from "./invitation.mapper"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { InvitationRepository } from "./invitation.repository"
import type { InvitationTargetType } from "./invitation.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import {
  InvitationAccessService,
  type InvitationAccessTarget,
  type WorkspaceAccess,
} from "./invitation-access.service"
import { buildInvitationEmail, buildInvitationLink } from "./invitation-email"

/** The target of an invitation, built by the controllers from the resource of the route. */
export type InvitationTarget = {
  targetType: InvitationTargetType
  targetId: string
  organizationId: string
  projectId: string
  /** Review campaign status, required for review campaign targets. */
  status?: string
}

/** Role stored on agent invitations, and on project invitations sent without a role. */
const DEFAULT_ROLE_BY_TARGET_TYPE = { project: "admin", agent: "member" } as const

/**
 * Invitations to a project, an agent or a review campaign.
 *
 * The platform sends no email. An admin invites people by email; an unknown
 * email gets an account that has never signed in, which the person's first
 * OIDC sign-in links through their verified email (see UsersService.findOrCreate).
 * The person then finds the invitation in the app and accepts or declines it.
 * Access is granted on acceptance only.
 */
@Injectable()
export class InvitationsService {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly invitationRepository: InvitationRepository,
    private readonly invitationAccessService: InvitationAccessService,
    private readonly usersService: UsersService,
    private readonly userRepository: UserRepository,
    private readonly mailerService: MailerService,
    private readonly permissionService: PermissionService,
  ) {}

  private readonly logger = new Logger(InvitationsService.name)

  /**
   * Skips service identities, people who already have this access, and people
   * already invited. When SMTP is configured, emails each new invitation with
   * its link after the invitations are saved. `emailSent` is true only when
   * every new invitation was emailed.
   *
   * On a project, a member invitation also gives the agents picked. People already in the
   * workspace get no invitation: they get the agents they miss right away (`grantedEmails`), and
   * are never promoted to admin.
   */
  async createMany(params: {
    target: InvitationTarget
    emails: string[]
    role?: string
    agentIds?: string[]
    inviter: { userId: string; name: string | null; email: string }
  }): Promise<{ invitations: Invitation[]; emailSent: boolean; grantedEmails: string[] }> {
    const role = this.resolveRole(params.target, params.role)
    const agentIds =
      params.target.targetType === "project" && role === "member" ? (params.agentIds ?? []) : []
    await this.assertCanInviteToAgents({
      projectId: params.target.projectId,
      agentIds,
      inviterUserId: params.inviter.userId,
    })
    const emails = [
      ...new Set(params.emails.map((email) => email.trim().toLowerCase()).filter(Boolean)),
    ]

    const grantedEmails: string[] = []
    const invitations = await this.transactionService.run(async () => {
      const invitations: Invitation[] = []
      for (const email of emails) {
        const existingUser = await this.usersService.findByEmail(email)
        if (isServiceIdentity({ email, user: existingUser })) continue

        const user = existingUser ?? (await this.usersService.findOrCreateByEmail({ email }))
        if (params.target.targetType === "project") {
          const access = await this.invitationAccessService.findWorkspaceAccess({
            userId: user.id,
            projectId: params.target.targetId,
            agentIds,
          })
          if (access) {
            const missingAgentIds = missingAgentIdsOf(access, role, agentIds)
            if (missingAgentIds.length > 0) {
              await this.invitationAccessService.grantAgents({
                userId: user.id,
                agentIds: missingAgentIds,
              })
              grantedEmails.push(email)
            }
            continue
          }
        } else {
          const accessTarget = toAccessTarget(params.target, role, agentIds)
          if (
            await this.invitationAccessService.hasAccess({ target: accessTarget, userId: user.id })
          ) {
            continue
          }
        }
        const pendingInvitation = await this.invitationRepository.findPendingForUserAndTarget({
          userId: user.id,
          targetType: params.target.targetType,
          targetId: params.target.targetId,
          // One pending invitation per person to a workspace, whatever it gives.
          role: params.target.targetType === "project" ? undefined : role,
        })
        if (pendingInvitation) continue

        invitations.push(
          await this.invitationRepository.createPending({
            organizationId: params.target.organizationId,
            projectId: params.target.projectId,
            targetType: params.target.targetType,
            targetId: params.target.targetId,
            userId: user.id,
            invitedEmail: email,
            role,
            agentIds,
            invitationToken: randomUUID(),
          }),
        )
      }
      return invitations
    })

    const emailSent = await this.emailInvitations(invitations, params.inviter)
    return { invitations, emailSent, grantedEmails }
  }

  /** What each person already in the workspace holds on it and on its agents. */
  async listInviteeAccess(projectId: string): Promise<WorkspaceAccess[]> {
    const agentIds = await this.invitationRepository.findLiveAgentIdsOfProject({ projectId })
    return this.invitationAccessService.listWorkspaceAccess({ projectId, agentIds })
  }

  /**
   * Each agent must be a live agent of the project, and the inviter must be allowed to invite
   * members to it.
   */
  private async assertCanInviteToAgents(params: {
    projectId: string
    agentIds: string[]
    inviterUserId: string
  }): Promise<void> {
    if (params.agentIds.length === 0) return
    const liveAgentIds = await this.invitationRepository.findLiveAgentIdsOfProject({
      projectId: params.projectId,
      agentIds: params.agentIds,
    })
    // Missing, deleted and another workspace's agent share one answer.
    if (params.agentIds.some((agentId) => !liveAgentIds.includes(agentId))) {
      throw new NotFoundException("Agent not found")
    }
    for (const agentId of params.agentIds) {
      const canInvite = await this.permissionService.has(
        params.inviterUserId,
        AGENT_MEMBER_INVITE_PERMISSION,
        { type: "agent", id: agentId },
      )
      if (!canInvite) {
        throw new ForbiddenException(
          `Missing ${AGENT_MEMBER_INVITE_PERMISSION} on agent ${agentId}`,
        )
      }
    }
  }

  /** A failed email never fails the invitation: the admin can still copy its link. */
  private async emailInvitations(
    invitations: Invitation[],
    inviter: { name: string | null; email: string },
  ): Promise<boolean> {
    if (invitations.length === 0 || !this.mailerService.isEnabled()) return false
    const appUrl = getAppPublicUrl()
    if (!appUrl) {
      this.logger.warn("SMTP is configured but APP_PUBLIC_URL and FRONTEND_URL are not set")
      return false
    }

    const detailsById = await this.invitationRepository.findDetailsByInvitationIds(
      invitations.map((invitation) => invitation.id),
    )
    let allSent = true
    for (const invitation of invitations) {
      const details = detailsById.get(invitation.id)
      const to = invitation.invitedEmail ?? ""
      try {
        await this.mailerService.send(
          buildInvitationEmail({
            to,
            link: buildInvitationLink(appUrl, to),
            inviterName: inviter.name || inviter.email,
            targetType: invitation.targetType,
            targetName: details?.targetName ?? "",
            organizationName: details?.organizationName ?? "",
          }),
        )
      } catch (error) {
        allSent = false
        this.logger.error(
          `Invitation email to invitation ${invitation.id} failed`,
          error instanceof Error ? error.stack : String(error),
        )
      }
    }
    return allSent
  }

  /** On an agent, also the workspace invitations that give it. */
  async listForTarget(target: InvitationTarget): Promise<Invitation[]> {
    if (target.targetType === "agent") {
      return this.invitationRepository.listPendingForAgent(target.targetId)
    }
    return this.invitationRepository.listPendingForTarget({
      targetType: target.targetType,
      targetId: target.targetId,
    })
  }

  /** Pending invitations whose target still exists. */
  async listPendingMine(userId: string): Promise<Invitation[]> {
    const invitations = await this.invitationRepository.listPendingForUser(userId)
    const detailsById = await this.invitationRepository.findDetailsByInvitationIds(
      invitations.map((invitation) => invitation.id),
    )
    return invitations.filter((invitation) => detailsById.get(invitation.id)?.targetExists)
  }

  /**
   * An invitation that is not pending, or belongs to another target, answers 404. On an agent, a
   * workspace invitation that gives it loses only this agent: the person is still invited to the
   * workspace and its other agents.
   */
  async revokeOne(params: { invitationId: string; target: InvitationTarget }): Promise<void> {
    const invitation =
      params.target.targetType === "agent"
        ? await this.invitationRepository.findPendingByIdForAgent({
            invitationId: params.invitationId,
            agentId: params.target.targetId,
          })
        : await this.invitationRepository.findPendingByIdForTarget({
            invitationId: params.invitationId,
            targetType: params.target.targetType,
            targetId: params.target.targetId,
          })
    if (!invitation) {
      throw new NotFoundException(`Pending invitation ${params.invitationId} not found`)
    }
    if (invitation.targetType !== params.target.targetType) {
      await this.invitationRepository.removeAgent({
        invitationId: invitation.id,
        agentId: params.target.targetId,
      })
      return
    }
    await this.transactionService.run(async () => {
      await this.invitationRepository.updateStatus({
        invitationId: invitation.id,
        status: "revoked",
      })
      if (invitation.userId) {
        await this.userRepository.deleteIfUnusedPlaceholder({ userId: invitation.userId })
      }
    })
  }

  /** Accepting twice is a no-op. */
  async acceptOne(params: { invitationId: string; userId: string }): Promise<void> {
    const invitation = await this.findInvitationOfUser(params)
    if (invitation.status === "accepted") return
    this.assertPending(invitation)

    const details = (
      await this.invitationRepository.findDetailsByInvitationIds([invitation.id])
    ).get(invitation.id)
    if (!details?.targetExists) {
      throw new NotFoundException(`Invitation ${invitation.id} not found`)
    }
    if (invitation.targetType === "review_campaign" && details.targetStatus !== "active") {
      throw new ConflictException(
        `Cannot join a ${details.targetStatus} campaign, ask its owner to activate it`,
      )
    }

    await this.transactionService.run(async () => {
      await this.invitationAccessService.grant({
        target: {
          targetType: invitation.targetType,
          targetId: invitation.targetId,
          organizationId: invitation.organizationId,
          projectId: invitation.projectId,
          role: invitation.role,
          // The agents deleted since the invitation are left out.
          agentIds: details.agents.map((agent) => agent.id),
        },
        userId: params.userId,
      })
      await this.invitationRepository.updateStatus({
        invitationId: invitation.id,
        status: "accepted",
      })
    })
  }

  async declineOne(params: { invitationId: string; userId: string }): Promise<void> {
    const invitation = await this.findInvitationOfUser(params)
    if (invitation.status === "declined") return
    this.assertPending(invitation)
    await this.invitationRepository.updateStatus({
      invitationId: invitation.id,
      status: "declined",
    })
  }

  async toDtos(invitations: Invitation[]): Promise<InvitationDto[]> {
    const detailsById = await this.invitationRepository.findDetailsByInvitationIds(
      invitations.map((invitation) => invitation.id),
    )
    return invitations.map((invitation) =>
      toInvitationDto(invitation, detailsById.get(invitation.id)),
    )
  }

  /** Someone else's invitation answers 404, like a missing one. */
  private async findInvitationOfUser(params: {
    invitationId: string
    userId: string
  }): Promise<Invitation> {
    const invitation = await this.invitationRepository.findById(params.invitationId)
    if (!invitation || invitation.userId !== params.userId) {
      throw new NotFoundException(`Invitation ${params.invitationId} not found`)
    }
    return invitation
  }

  private assertPending(invitation: Invitation): void {
    if (invitation.status !== "pending") {
      throw new ConflictException(`This invitation was ${invitation.status}`)
    }
  }

  private resolveRole(target: InvitationTarget, role: string | undefined): string {
    if (target.targetType === "project") {
      if (role === undefined) return DEFAULT_ROLE_BY_TARGET_TYPE.project
      if (role !== "admin" && role !== "member") {
        throw new BadRequestException(`Invalid workspace role: ${role}`)
      }
      return role
    }
    if (target.targetType !== "review_campaign") {
      return DEFAULT_ROLE_BY_TARGET_TYPE[target.targetType]
    }
    if (!role) {
      throw new BadRequestException("role is required to invite review campaign members")
    }
    if (!isReviewCampaignMembershipRole(role)) {
      throw new BadRequestException(`Invalid review campaign role: ${role}`)
    }
    if (target.status !== "active") {
      throw new ConflictException(
        `Cannot invite members to a ${target.status} campaign, activate it first`,
      )
    }
    return role
  }
}

function toAccessTarget(
  target: InvitationTarget,
  role: string,
  agentIds: string[],
): InvitationAccessTarget {
  return {
    targetType: target.targetType,
    targetId: target.targetId,
    organizationId: target.organizationId,
    projectId: target.projectId,
    role,
    agentIds,
  }
}

/**
 * The agents a person already in the workspace misses. An admin already is admin of every agent,
 * and a member invited as admin is not promoted: neither gets anything.
 */
function missingAgentIdsOf(
  access: Pick<WorkspaceAccess, "workspaceRoleKey" | "agentIds">,
  role: string,
  agentIds: string[],
): string[] {
  if (access.workspaceRoleKey !== PROJECT_ROLES.member || role !== "member") return []
  return agentIds.filter((agentId) => !access.agentIds.includes(agentId))
}

function isReviewCampaignMembershipRole(value: string): value is ReviewCampaignMembershipRole {
  return value === "tester" || value === "reviewer"
}
