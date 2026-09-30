import { BadRequestException, ConflictException, Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipsService } from "@/domains/agents/memberships/agent-memberships.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationMembershipsService } from "@/domains/organizations/memberships/organization-memberships.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipsService } from "@/domains/projects/memberships/project-memberships.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewCampaignMembershipsService } from "@/domains/review-campaigns/memberships/review-campaign-memberships.service"
import type { ReviewCampaignMembershipRole } from "@/domains/review-campaigns/review-campaigns.types"
import { isServiceIdentity } from "@/domains/users/service-user.helpers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { UsersService } from "@/domains/users/users.service"

/** Structural shapes of the targets, so this domain does not import other domains' entities. */
type ProjectTarget = { id: string; organizationId: string }
type AgentTarget = { id: string; organizationId: string; projectId: string }
type ReviewCampaignTarget = {
  id: string
  organizationId: string
  projectId: string
  status: string
}

export type MemberGrantTarget =
  | { type: "project"; project: ProjectTarget }
  | { type: "agent"; agent: AgentTarget }
  | { type: "review_campaign"; reviewCampaign: ReviewCampaignTarget }

/**
 * Gives people access to a project, an agent or a review campaign by email.
 *
 * Access is granted right away. An unknown email gets an account that has
 * never signed in; the person's first OIDC sign-in with that email links it
 * (see UsersService.findOrCreate). The platform sends no email: the customer
 * creates the account in their identity provider and tells the person.
 */
@Injectable()
export class MemberGrantsService {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly usersService: UsersService,
    private readonly organizationMembershipsService: OrganizationMembershipsService,
    private readonly projectMembershipsService: ProjectMembershipsService,
    private readonly agentMembershipsService: AgentMembershipsService,
    private readonly reviewCampaignMembershipsService: ReviewCampaignMembershipsService,
  ) {}

  /** Returns the normalized emails that received access; existing members and service identities are skipped. */
  async grantAccess(params: {
    target: MemberGrantTarget
    emails: string[]
    role?: string
  }): Promise<string[]> {
    const reviewCampaignRole = this.validateTarget(params.target, params.role)
    const emails = [
      ...new Set(params.emails.map((email) => email.trim().toLowerCase()).filter(Boolean)),
    ]

    return this.transactionService.run(async () => {
      const grantedEmails: string[] = []
      for (const email of emails) {
        const existingUser = await this.usersService.findByEmail(email)
        if (isServiceIdentity({ email, user: existingUser })) continue

        const user = existingUser ?? (await this.usersService.findOrCreateByEmail({ email }))
        const granted = await this.grantToUser({
          target: params.target,
          user,
          reviewCampaignRole,
        })
        if (granted) grantedEmails.push(email)
      }
      return grantedEmails
    })
  }

  private validateTarget(
    target: MemberGrantTarget,
    role: string | undefined,
  ): ReviewCampaignMembershipRole | undefined {
    if (target.type !== "review_campaign") return undefined
    if (!role) {
      throw new BadRequestException("role is required to add review campaign members")
    }
    if (!isReviewCampaignMembershipRole(role)) {
      throw new BadRequestException(`Invalid review campaign role: ${role}`)
    }
    if (target.reviewCampaign.status !== "active") {
      throw new ConflictException(
        `Cannot add members to a ${target.reviewCampaign.status} campaign, activate it first`,
      )
    }
    return role
  }

  /** Returns false when the user already had this access. */
  private async grantToUser(params: {
    target: MemberGrantTarget
    user: { id: string }
    reviewCampaignRole: ReviewCampaignMembershipRole | undefined
  }): Promise<boolean> {
    const { target, user } = params
    switch (target.type) {
      case "project":
        return this.grantProjectAccess({ project: target.project, userId: user.id })
      case "agent":
        return this.grantAgentAccess({ agent: target.agent, userId: user.id })
      case "review_campaign":
        return this.grantReviewCampaignAccess({
          reviewCampaign: target.reviewCampaign,
          userId: user.id,
          role: params.reviewCampaignRole as ReviewCampaignMembershipRole,
        })
    }
  }

  /** Project members are added as project admins (and organization admins), as before. */
  private async grantProjectAccess(params: {
    project: ProjectTarget
    userId: string
  }): Promise<boolean> {
    const existingMembership = await this.projectMembershipsService.findProjectMembership({
      userId: params.userId,
      projectId: params.project.id,
    })
    if (existingMembership) return false

    await this.organizationMembershipsService.upsertOrganizationAdminMembership({
      userId: params.userId,
      organizationId: params.project.organizationId,
    })
    await this.projectMembershipsService.upsertProjectAdminMembership({
      userId: params.userId,
      projectId: params.project.id,
    })
    return true
  }

  private async grantAgentAccess(params: { agent: AgentTarget; userId: string }): Promise<boolean> {
    const existingMembership = await this.agentMembershipsService.findAgentMembership({
      agentId: params.agent.id,
      userId: params.userId,
    })
    if (existingMembership) return false

    await this.organizationMembershipsService.upsertOrganizationMemberMembership({
      userId: params.userId,
      organizationId: params.agent.organizationId,
    })
    await this.projectMembershipsService.upsertProjectMemberMembership({
      userId: params.userId,
      projectId: params.agent.projectId,
    })
    await this.agentMembershipsService.upsertAgentMemberMembership({
      userId: params.userId,
      agentId: params.agent.id,
      role: "member",
    })
    return true
  }

  private async grantReviewCampaignAccess(params: {
    reviewCampaign: ReviewCampaignTarget
    userId: string
    role: ReviewCampaignMembershipRole
  }): Promise<boolean> {
    const { reviewCampaign, userId, role } = params
    const existingMembership =
      await this.reviewCampaignMembershipsService.findByUserCampaignAndRole({
        userId,
        campaignId: reviewCampaign.id,
        role,
      })
    if (existingMembership) return false

    await this.organizationMembershipsService.upsertOrganizationMemberMembership({
      userId,
      organizationId: reviewCampaign.organizationId,
    })
    await this.projectMembershipsService.upsertProjectMemberMembership({
      userId,
      projectId: reviewCampaign.projectId,
    })
    await this.reviewCampaignMembershipsService.acceptCampaignMembership({
      campaignId: reviewCampaign.id,
      userId,
      role,
      organizationId: reviewCampaign.organizationId,
      projectId: reviewCampaign.projectId,
    })
    return true
  }
}

function isReviewCampaignMembershipRole(value: string): value is ReviewCampaignMembershipRole {
  return value === "tester" || value === "reviewer"
}
