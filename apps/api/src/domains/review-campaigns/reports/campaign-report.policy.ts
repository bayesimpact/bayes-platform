import type { OrganizationMembershipContextModel } from "@/domains/organizations/memberships/organization-membership.model"
import type { ProjectMembershipFixture } from "@/domains/projects/memberships/project-membership.types"
import type { Project } from "@/domains/projects/project.entity"
import type { ReviewCampaignMembershipModel } from "../memberships/review-campaign-membership.model"
import type { ReviewCampaign } from "../review-campaign.entity"
import { ReviewCampaignPolicy } from "../review-campaign.policy"
import { ReviewerPolicy } from "../reviewer/reviewer.policy"

type CampaignReportPolicyContext = {
  organizationMembership: OrganizationMembershipContextModel
  project: Project | undefined
  projectMembership: ProjectMembershipFixture | undefined
  reviewCampaign: ReviewCampaign
  reviewerMembership: ReviewCampaignMembershipModel | undefined
}

/**
 * Report access is dual-role: either a project admin/owner viewing from the
 * campaign editor, or an accepted reviewer viewing from the reviewer landing.
 * Testers intentionally don't see the report.
 */
export class CampaignReportPolicy {
  constructor(private readonly context: CampaignReportPolicyContext) {}

  canView(): boolean {
    return this.canViewAsAdmin() || this.canViewAsReviewer()
  }

  private canViewAsAdmin(): boolean {
    const adminPolicy = new ReviewCampaignPolicy(
      {
        organizationMembership: this.context.organizationMembership,
        project: this.context.project,
        projectMembership: this.context.projectMembership,
      },
      this.context.reviewCampaign,
    )
    return adminPolicy.canView()
  }

  private canViewAsReviewer(): boolean {
    const reviewerPolicy = new ReviewerPolicy({
      reviewCampaign: this.context.reviewCampaign,
      reviewerMembership: this.context.reviewerMembership,
    })
    return reviewerPolicy.canView()
  }
}
