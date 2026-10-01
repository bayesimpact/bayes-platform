import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipsService } from "@/domains/agents/memberships/agent-memberships.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationMembershipsService } from "@/domains/organizations/memberships/organization-memberships.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipsService } from "@/domains/projects/memberships/project-memberships.service"
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

  async hasAccess(params: { target: InvitationAccessTarget; userId: string }): Promise<boolean> {
    const { target, userId } = params
    switch (target.targetType) {
      case "project":
        return Boolean(
          await this.projectMembershipsService.findProjectMembership({
            userId,
            projectId: target.targetId,
          }),
        )
      case "agent":
        return Boolean(
          await this.agentMembershipsService.findAgentMembership({
            agentId: target.targetId,
            userId,
          }),
        )
      case "review_campaign":
        return Boolean(
          await this.reviewCampaignMembershipsService.findByUserCampaignAndRole({
            userId,
            campaignId: target.targetId,
            role: target.role as ReviewCampaignMembershipRole,
          }),
        )
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
        await this.organizationMembershipsService.upsertOrganizationMemberMembership({
          userId,
          organizationId: target.organizationId,
        })
        await this.projectMembershipsService.upsertProjectMemberMembership({
          userId,
          projectId: target.projectId,
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
