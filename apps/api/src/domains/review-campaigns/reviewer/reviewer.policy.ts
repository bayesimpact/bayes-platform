import { BasePolicy } from "@/common/policies/base-policy"
import type { ReviewCampaignMembershipModel } from "../memberships/review-campaign-membership.model"
import type { ReviewCampaign } from "../review-campaign.entity"

type ReviewerPolicyContext = {
  reviewCampaign: ReviewCampaign
  reviewerMembership: ReviewCampaignMembershipModel | undefined
}

export class ReviewerPolicy extends BasePolicy<ReviewCampaign> {
  private readonly reviewCampaign: ReviewCampaign
  private readonly reviewerMembership: ReviewCampaignMembershipModel | undefined

  constructor(context: ReviewerPolicyContext) {
    // Mirrors TesterPolicy: no organization-membership gate; access is
    // (reviewer role on this campaign) × (campaign status).
    super({} as never, context.reviewCampaign)
    this.reviewCampaign = context.reviewCampaign
    this.reviewerMembership = context.reviewerMembership
  }

  canList(): boolean {
    return this.canView()
  }

  canView(): boolean {
    // Read access: active membership + campaign is not still in draft. Closed
    // campaigns keep reviewer read access (spec §3 "Read sessions they don't
    // review (closed campaign)").
    return this.isActiveReviewerMember() && this.isCampaignNotDraft()
  }

  canCreate(): boolean {
    return this.canReview()
  }

  canUpdate(): boolean {
    return this.canReview()
  }

  canReview(): boolean {
    // Write access: active membership + campaign currently active. Closed and
    // draft campaigns reject submit/update.
    return this.isActiveReviewerMember() && this.isCampaignActive()
  }

  private isActiveReviewerMember(): boolean {
    return (
      !!this.reviewerMembership && this.reviewerMembership.campaignId === this.reviewCampaign.id
    )
  }

  private isCampaignActive(): boolean {
    return this.reviewCampaign.status === "active"
  }

  private isCampaignNotDraft(): boolean {
    return this.reviewCampaign.status !== "draft"
  }
}
