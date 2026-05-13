import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { EntityManager } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource, In, type Repository } from "typeorm"
import {
  INVITATION_SENDER,
  type InvitationSender,
} from "@/domains/auth/invitation-sender.interface"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { InvitationPersistenceService } from "@/domains/invitations/invitation-persistence.service"
import { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
import { ReviewCampaignMembership } from "@/domains/review-campaigns/memberships/review-campaign-membership.entity"
import { ReviewCampaign } from "@/domains/review-campaigns/review-campaign.entity"
import type { ReviewCampaignMembershipRole } from "@/domains/review-campaigns/review-campaigns.types"
import { User } from "@/domains/users/user.entity"
import { Invitation } from "../invitation.entity"
import type {
  InvitationAcceptanceHandler,
  InvitationAcceptanceType,
} from "./invitation-acceptance.handler"
import type {
  CreateInvitationsForTargetParams,
  InvitationTargetHandler,
  InvitationTargetScope,
} from "./invitation-target.handler"

type InviteMembersContext = {
  userRepository: Repository<User>
  membershipRepository: Repository<ReviewCampaignMembership>
  invitationRepository: Repository<Invitation>
  reviewCampaign: Pick<ReviewCampaign, "id" | "organizationId" | "projectId" | "status">
}

function isReviewCampaignMembershipRole(
  value: string | undefined,
): value is ReviewCampaignMembershipRole {
  return value === "tester" || value === "reviewer"
}

@Injectable()
export class ReviewCampaignInvitationHandler
  implements InvitationTargetHandler, InvitationAcceptanceHandler
{
  readonly targetType = "review_campaign" as const
  readonly acceptanceType: InvitationAcceptanceType = "reviewCampaign"

  constructor(
    @InjectRepository(ReviewCampaign)
    private readonly reviewCampaignRepository: Repository<ReviewCampaign>,
    @InjectRepository(ReviewCampaignMembership)
    readonly _reviewCampaignMembershipRepository: Repository<ReviewCampaignMembership>,
    @InjectRepository(Invitation)
    private readonly invitationRepository: Repository<Invitation>,
    @Inject(INVITATION_SENDER)
    private readonly invitationSender: InvitationSender,
    private readonly dataSource: DataSource,
    private readonly invitationPersistence: InvitationPersistenceService,
  ) {}

  async createInvitations(params: CreateInvitationsForTargetParams): Promise<Invitation[]> {
    if (!params.role) {
      throw new BadRequestException("role is required for review campaign invitations")
    }
    if (!isReviewCampaignMembershipRole(params.role)) {
      throw new BadRequestException(`Invalid review campaign invitation role: ${params.role}`)
    }
    return this.inviteMembers({
      reviewCampaignId: params.targetId,
      emails: params.emails,
      inviterName: params.inviterName,
      role: params.role,
    })
  }

  async inviteMembers(params: {
    reviewCampaignId: string
    emails: string[]
    inviterName: string
    role: ReviewCampaignMembershipRole
  }): Promise<Invitation[]> {
    return this.dataSource.transaction(async (manager) => {
      const context = await this.buildInviteMembersContext({
        manager,
        reviewCampaignId: params.reviewCampaignId,
      })
      return this.collectInvitationsForEmails({
        emails: params.emails,
        inviterName: params.inviterName,
        role: params.role,
        manager,
        context,
      })
    })
  }

  private async buildInviteMembersContext(params: {
    manager: EntityManager
    reviewCampaignId: string
  }): Promise<InviteMembersContext> {
    const reviewCampaign = await params.manager.getRepository(ReviewCampaign).findOneOrFail({
      where: { id: params.reviewCampaignId },
      select: { id: true, organizationId: true, projectId: true, status: true },
    })
    if (reviewCampaign.status !== "active") {
      throw new ConflictException(
        `Cannot invite members to a ${reviewCampaign.status} campaign — activate it first`,
      )
    }
    return {
      userRepository: params.manager.getRepository(User),
      membershipRepository: params.manager.getRepository(ReviewCampaignMembership),
      invitationRepository: params.manager.getRepository(Invitation),
      reviewCampaign,
    }
  }

  private async collectInvitationsForEmails(params: {
    emails: string[]
    inviterName: string
    role: ReviewCampaignMembershipRole
    manager: EntityManager
    context: InviteMembersContext
  }): Promise<Invitation[]> {
    const createdInvitations: Invitation[] = []
    for (const email of params.emails) {
      const invitation = await this.inviteOneMember({
        email,
        inviterName: params.inviterName,
        role: params.role,
        manager: params.manager,
        context: params.context,
      })
      if (invitation) {
        createdInvitations.push(invitation)
      }
    }
    return createdInvitations
  }

  private async inviteOneMember(params: {
    email: string
    inviterName: string
    role: ReviewCampaignMembershipRole
    manager: EntityManager
    context: InviteMembersContext
  }): Promise<Invitation | null> {
    const normalizedEmail = params.email.trim().toLowerCase()
    if (!normalizedEmail) return null

    const existingUser = await params.context.userRepository.findOne({
      where: { email: normalizedEmail },
    })
    if (
      await this.shouldSkipInvitation({
        existingUser,
        normalizedEmail,
        role: params.role,
        context: params.context,
      })
    ) {
      return null
    }

    const { ticketId } = await this.invitationSender.sendInvitation({
      inviteeEmail: normalizedEmail,
      inviterName: params.inviterName,
    })
    return this.invitationPersistence.createPendingReviewCampaignInvitation(
      {
        organizationId: params.context.reviewCampaign.organizationId,
        projectId: params.context.reviewCampaign.projectId,
        campaignId: params.context.reviewCampaign.id,
        userId: existingUser?.id ?? null,
        invitedEmail: normalizedEmail,
        invitationToken: ticketId,
        role: params.role,
        invitedAt: new Date(),
      },
      params.manager,
    )
  }

  private async shouldSkipInvitation(params: {
    existingUser: User | null
    normalizedEmail: string
    role: ReviewCampaignMembershipRole
    context: InviteMembersContext
  }): Promise<boolean> {
    if (params.existingUser) {
      const existingMembership = await params.context.membershipRepository.findOne({
        where: {
          campaignId: params.context.reviewCampaign.id,
          userId: params.existingUser.id,
          role: params.role,
        },
      })
      if (existingMembership) return true
    }

    const existingPendingInvitation = await params.context.invitationRepository.findOne({
      where: {
        targetType: "review_campaign",
        targetId: params.context.reviewCampaign.id,
        invitedEmail: params.normalizedEmail,
        status: "pending",
      },
      select: { id: true },
    })
    return !!existingPendingInvitation
  }

  async resolveScope(targetId: string): Promise<InvitationTargetScope> {
    const reviewCampaign = await this.reviewCampaignRepository.findOne({ where: { id: targetId } })
    if (!reviewCampaign) {
      throw new NotFoundException(`Review campaign ${targetId} not found`)
    }
    return { organizationId: reviewCampaign.organizationId, projectId: reviewCampaign.projectId }
  }

  async resolveTargetNameByInvitationId(invitations: Invitation[]): Promise<Map<string, string>> {
    const reviewCampaignIds = [...new Set(invitations.map((invitation) => invitation.targetId))]
    if (reviewCampaignIds.length === 0) return new Map<string, string>()

    const reviewCampaigns = await this.reviewCampaignRepository.find({
      where: { id: In(reviewCampaignIds) },
      select: { id: true, name: true },
    })
    const reviewCampaignNameById = new Map(
      reviewCampaigns.map((reviewCampaign) => [reviewCampaign.id, reviewCampaign.name]),
    )

    const targetNameByInvitationId = new Map<string, string>()
    for (const invitation of invitations) {
      targetNameByInvitationId.set(
        invitation.id,
        reviewCampaignNameById.get(invitation.targetId) ?? "",
      )
    }
    return targetNameByInvitationId
  }

  async canHandle(ticketId: string): Promise<boolean> {
    const invitation = await this.invitationRepository.findOne({
      where: { invitationToken: ticketId, targetType: "review_campaign" },
      select: { id: true },
    })
    return !!invitation
  }

  async acceptInvitation(params: {
    ticketId: string
    auth0Sub: string
    email: string
  }): Promise<{ userId: string }> {
    return this.dataSource.transaction(async (manager) => {
      const membershipRepository = manager.getRepository(ReviewCampaignMembership)
      const userRepository = manager.getRepository(User)
      const invitationRepository = manager.getRepository(Invitation)
      const organizationMembershipRepository = manager.getRepository(OrganizationMembership)
      const projectMembershipRepository = manager.getRepository(ProjectMembership)
      const reviewCampaignRepository = manager.getRepository(ReviewCampaign)

      const invitation = await invitationRepository.findOne({
        where: { invitationToken: params.ticketId, targetType: "review_campaign" },
      })
      if (!invitation) {
        throw new NotFoundException(
          `No review-campaign invitation found for ticket: ${params.ticketId}`,
        )
      }
      if (
        invitation.invitedEmail &&
        invitation.invitedEmail.trim().toLowerCase() !== params.email.trim().toLowerCase()
      ) {
        throw new UnauthorizedException(`No invitation found for email: ${params.email}`)
      }
      const user = await this.resolveAcceptedUser({
        userRepository,
        auth0Sub: params.auth0Sub,
        email: params.email,
      })

      const campaign = await reviewCampaignRepository.findOneOrFail({
        where: { id: invitation.targetId },
      })
      await this.ensureOrganizationMembership({
        organizationMembershipRepository,
        userId: user.id,
        organizationId: campaign.organizationId,
      })
      await this.ensureProjectMembership({
        projectMembershipRepository,
        userId: user.id,
        projectId: campaign.projectId,
      })
      const existingMembership = await membershipRepository.findOne({
        where: {
          campaignId: invitation.targetId,
          userId: user.id,
          role: invitation.role as ReviewCampaignMembershipRole,
        },
      })
      if (existingMembership) {
        if (!existingMembership.acceptedAt) {
          existingMembership.acceptedAt = new Date()
          await membershipRepository.save(existingMembership)
        }
      } else {
        const membership = membershipRepository.create({
          organizationId: campaign.organizationId,
          projectId: campaign.projectId,
          campaignId: invitation.targetId,
          userId: user.id,
          role: invitation.role as ReviewCampaignMembershipRole,
          acceptedAt: new Date(),
        })
        await membershipRepository.save(membership)
      }
      await invitationRepository.update({ id: invitation.id }, { userId: user.id })
      return { userId: user.id }
    })
  }

  private async resolveAcceptedUser(params: {
    userRepository: Repository<User>
    auth0Sub: string
    email: string
  }): Promise<User> {
    const normalizedEmail = params.email.trim().toLowerCase()
    const byAuth0Id = await params.userRepository.findOne({ where: { auth0Id: params.auth0Sub } })
    if (byAuth0Id) return byAuth0Id
    const byEmail = await params.userRepository.findOne({ where: { email: normalizedEmail } })
    if (byEmail) {
      if (byEmail.auth0Id !== params.auth0Sub) {
        byEmail.auth0Id = params.auth0Sub
        return params.userRepository.save(byEmail)
      }
      return byEmail
    }
    const user = params.userRepository.create({
      auth0Id: params.auth0Sub,
      email: normalizedEmail,
      name: null,
      pictureUrl: null,
    })
    return params.userRepository.save(user)
  }

  private async ensureOrganizationMembership(params: {
    organizationMembershipRepository: Repository<OrganizationMembership>
    userId: string
    organizationId: string
  }): Promise<void> {
    const existingMembership = await params.organizationMembershipRepository.findOne({
      where: { userId: params.userId, organizationId: params.organizationId },
    })
    if (existingMembership) return
    const membership = params.organizationMembershipRepository.create({
      userId: params.userId,
      organizationId: params.organizationId,
      role: "member",
    })
    await params.organizationMembershipRepository.save(membership)
  }

  private async ensureProjectMembership(params: {
    projectMembershipRepository: Repository<ProjectMembership>
    userId: string
    projectId: string
  }): Promise<void> {
    const existingMembership = await params.projectMembershipRepository.findOne({
      where: { userId: params.userId, projectId: params.projectId },
    })
    if (existingMembership) return
    const membership = params.projectMembershipRepository.create({
      userId: params.userId,
      projectId: params.projectId,
      role: "member",
    })
    await params.projectMembershipRepository.save(membership)
  }
}
