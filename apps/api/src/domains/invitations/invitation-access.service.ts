import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipsService } from "@/domains/agents/memberships/agent-memberships.service"
import { hasRole } from "@/domains/memberships/membership-roles"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationMembershipsService } from "@/domains/organizations/memberships/organization-memberships.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipsService } from "@/domains/projects/memberships/project-memberships.service"
import { PROJECT_ROLES } from "@/domains/rbac/rbac.constants"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewCampaignMembershipsService } from "@/domains/review-campaigns/memberships/review-campaign-memberships.service"
import type { ReviewCampaignMembershipRole } from "@/domains/review-campaigns/review-campaigns.types"
import type { InvitationTargetType } from "./invitation.types"

/** Where an invitation gives access. Structural, so this domain does not import other domains' entities. */
export type InvitationAccessTarget = {
  targetType: InvitationTargetType
  targetId: string
  organizationId: string
  projectId: string
  /** Review campaign role (tester or reviewer). Unused for other targets. */
  role: string
}

/** Reads and creates the memberships an accepted invitation stands for. */
@Injectable()
export class InvitationAccessService {
  constructor(
    private readonly organizationMembershipsService: OrganizationMembershipsService,
    private readonly projectMembershipsService: ProjectMembershipsService,
    private readonly agentMembershipsService: AgentMembershipsService,
    private readonly reviewCampaignMembershipsService: ReviewCampaignMembershipsService,
  ) {}

  /**
   * Whether the user already holds what the invitation would give. A project
   * invitation makes an admin, so a person holding only `project_member` (who
   * joined through an agent) can still be invited, and becomes admin on
   * accepting. On an agent, only a member role counts: a conversation reviewer
   * grant alone does not.
   */
  async hasAccess(params: { target: InvitationAccessTarget; userId: string }): Promise<boolean> {
    const { target, userId } = params
    switch (target.targetType) {
      case "project": {
        const membership = await this.projectMembershipsService.findProjectMembership({
          userId,
          projectId: target.targetId,
        })
        return Boolean(
          membership &&
            (hasRole(membership, PROJECT_ROLES.admin) || hasRole(membership, PROJECT_ROLES.owner)),
        )
      }
      case "agent":
        return Boolean(
          await this.agentMembershipsService.findAgentMembership({
            agentId: target.targetId,
            userId,
          }),
        )
      case "review_campaign": {
        const membership = await this.reviewCampaignMembershipsService.findByUserCampaignAndRole({
          userId,
          campaignId: target.targetId,
          role: target.role as ReviewCampaignMembershipRole,
        })
        return Boolean(membership)
      }
    }
  }

  /** Call inside a transaction. Does nothing for a membership that already exists. */
  async grant(params: { target: InvitationAccessTarget; userId: string }): Promise<void> {
    const { target, userId } = params
    switch (target.targetType) {
      case "project":
        // Project members are project admins (and organization admins), as before.
        await this.organizationMembershipsService.upsertOrganizationAdminMembership({
          userId,
          organizationId: target.organizationId,
        })
        await this.projectMembershipsService.upsertProjectAdminMembership({
          userId,
          projectId: target.targetId,
        })
        return
      case "agent":
        await this.organizationMembershipsService.upsertOrganizationMemberMembership({
          userId,
          organizationId: target.organizationId,
        })
        await this.projectMembershipsService.upsertProjectMemberMembership({
          userId,
          projectId: target.projectId,
        })
        await this.agentMembershipsService.upsertAgentMemberMembership({
          userId,
          agentId: target.targetId,
          role: "member",
        })
        return
      case "review_campaign":
        // No project role: the campaign role gives what the person needs on the project
        // (PROJECT_PERMISSIONS_FROM_REVIEW_CAMPAIGN). The organization row stays, since every
        // organization-scoped route requires one.
        await this.organizationMembershipsService.upsertOrganizationMemberMembership({
          userId,
          organizationId: target.organizationId,
        })
        await this.reviewCampaignMembershipsService.acceptCampaignMembership({
          campaignId: target.targetId,
          userId,
          role: target.role as ReviewCampaignMembershipRole,
          organizationId: target.organizationId,
          projectId: target.projectId,
        })
        return
    }
  }
}
