import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { User } from "@/domains/users/user.entity"
import type { ReviewCampaign } from "../review-campaign.entity"
import type { ReviewCampaignMembership } from "./review-campaign-membership.entity"

type ReviewCampaignMembershipTransientParams = RequiredScopeTransientParams & {
  campaign: ReviewCampaign
  user: User
}

class ReviewCampaignMembershipFactory extends Factory<
  ReviewCampaignMembership,
  ReviewCampaignMembershipTransientParams
> {
  tester() {
    return this.params({ role: "tester" })
  }

  reviewer() {
    return this.params({ role: "reviewer" })
  }

  accepted() {
    return this.params({ acceptedAt: new Date() })
  }
}

export const reviewCampaignMembershipFactory = ReviewCampaignMembershipFactory.define(
  ({ params, transientParams }) => {
    if (!transientParams.organization) {
      throw new Error("organization transient is required")
    }
    if (!transientParams.project) {
      throw new Error("project transient is required")
    }
    if (!transientParams.campaign) {
      throw new Error("campaign transient is required")
    }
    if (!transientParams.user) {
      throw new Error("user transient is required")
    }

    const now = new Date()
    return {
      id: params.id || randomUUID(),
      createdAt: params.createdAt || now,
      updatedAt: params.updatedAt || now,
      deletedAt: params.deletedAt ?? null,
      organizationId: transientParams.organization.id,
      projectId: transientParams.project.id,
      campaignId: transientParams.campaign.id,
      campaign: transientParams.campaign,
      userId: transientParams.user.id,
      user: transientParams.user,
      role: params.role || "tester",
      acceptedAt: params.acceptedAt ?? null,
    } satisfies ReviewCampaignMembership
  },
)
