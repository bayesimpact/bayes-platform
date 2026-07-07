import { BasePolicy } from "@/common/policies/base-policy"
import type { ReviewCampaignMembershipModel } from "../memberships/review-campaign-membership.model"
import type { ReviewCampaign } from "../review-campaign.entity"

type TesterPolicyContext = {
  reviewCampaign: ReviewCampaign
  testerMembership: ReviewCampaignMembershipModel | undefined
  reviewerMembership: ReviewCampaignMembershipModel | undefined
}

export class TesterPolicy extends BasePolicy<ReviewCampaign> {
  private readonly reviewCampaign: ReviewCampaign
  private readonly testerMembership: ReviewCampaignMembershipModel | undefined
  private readonly reviewerMembership: ReviewCampaignMembershipModel | undefined

  constructor(context: TesterPolicyContext) {
    // BasePolicy's organizationMembership is not relevant for tester auth — the
    // entire access check is (membership role on this campaign) × (campaign status).
    // We pass an unused organizationMembership stub to satisfy the signature; the
    // policy methods never read it.
    super({} as never, context.reviewCampaign)
    this.reviewCampaign = context.reviewCampaign
    this.testerMembership = context.testerMembership
    this.reviewerMembership = context.reviewerMembership
  }

  // These BasePolicy methods are all gated by the same tester access rule;
  // overriding them lets controllers write `@CheckPolicy((p) => p.canCreate())`
  // (or canView/canUpdate/canList) and keep the @CheckPolicy handler type-safe.
  canList(): boolean {
    return this.canActAsTester()
  }

  canView(): boolean {
    return this.canActAsTester()
  }

  canCreate(): boolean {
    return this.canActAsTester()
  }

  canUpdate(): boolean {
    return this.canActAsTester()
  }

  canActAsTester(): boolean {
    return this.isActiveTesterMember() && this.isCampaignActive()
  }

  /**
   * Used only by `getTesterContext`, which is intentionally shared with the
   * reviewer landing page (campaign name / description / agent snapshot are
   * neutral metadata, and the tester per-session questions are already visible
   * to reviewers via blind review). Testers need an active campaign; reviewers
   * keep read access on closed campaigns too. A user holding both roles on
   * the same campaign passes if either role's gate is open.
   */
  canViewSharedContext(): boolean {
    if (this.isMembershipForCampaign(this.testerMembership) && this.isCampaignActive()) {
      return true
    }
    if (this.isMembershipForCampaign(this.reviewerMembership) && this.isCampaignNotDraft()) {
      return true
    }
    return false
  }

  private isActiveTesterMember(): boolean {
    return this.isMembershipForCampaign(this.testerMembership)
  }

  private isMembershipForCampaign(
    membership: ReviewCampaignMembershipModel | undefined,
  ): membership is ReviewCampaignMembershipModel {
    return !!membership && membership.campaignId === this.reviewCampaign.id
  }

  private isCampaignActive(): boolean {
    return this.reviewCampaign.status === "active"
  }

  private isCampaignNotDraft(): boolean {
    return this.reviewCampaign.status !== "draft"
  }
}
