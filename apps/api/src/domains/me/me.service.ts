import { Injectable } from "@nestjs/common"
import type { AgentMembershipModel } from "@/domains/agents/memberships/agent-membership.model"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipsService } from "@/domains/agents/memberships/agent-memberships.service"
import type { OrganizationMembershipModel } from "@/domains/organizations/memberships/organization-membership.model"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { OrganizationMembershipsService } from "@/domains/organizations/memberships/organization-memberships.service"
import type { ProjectMembershipModel } from "@/domains/projects/memberships/project-membership.model"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectMembershipsService } from "@/domains/projects/memberships/project-memberships.service"
import type { ReviewCampaignMembershipModel } from "@/domains/review-campaigns/memberships/review-campaign-membership.model"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ReviewCampaignMembershipsService } from "@/domains/review-campaigns/memberships/review-campaign-memberships.service"

@Injectable()
export class MeService {
  constructor(
    private readonly organizationMembershipsService: OrganizationMembershipsService,
    private readonly projectMembershipsService: ProjectMembershipsService,
    private readonly agentMembershipsService: AgentMembershipsService,
    private readonly reviewCampaignMembershipsService: ReviewCampaignMembershipsService,
  ) {}

  async getUserMemberships(userId: string): Promise<{
    organizationMemberships: OrganizationMembershipModel[]
    projectMemberships: ProjectMembershipModel[]
    agentMemberships: AgentMembershipModel[]
    reviewCampaignMemberships: ReviewCampaignMembershipModel[]
  }> {
    const [
      organizationMemberships,
      projectMemberships,
      agentMemberships,
      reviewCampaignMemberships,
    ] = await Promise.all([
      this.organizationMembershipsService.listMembershipsForUser(userId),
      this.projectMembershipsService.listMembershipsForUser(userId),
      this.agentMembershipsService.listMembershipsForUser(userId),
      this.reviewCampaignMembershipsService.listMembershipsForUser(userId),
    ])

    return {
      organizationMemberships,
      projectMemberships,
      agentMemberships,
      reviewCampaignMemberships,
    }
  }
}
