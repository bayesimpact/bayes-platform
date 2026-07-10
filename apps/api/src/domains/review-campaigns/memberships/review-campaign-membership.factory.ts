import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { AllRepositories } from "@/common/test/test-transaction-manager"
import { userMembershipFactory } from "@/domains/memberships/user-membership.factory"
import type { User } from "@/domains/users/user.entity"
import type { ReviewCampaign } from "../review-campaign.entity"
import type { ReviewCampaignMembershipFixture } from "./review-campaign-membership.types"

type ReviewCampaignMembershipTransientParams = RequiredScopeTransientParams & {
  campaign: ReviewCampaign
  user: User
}

class ReviewCampaignMembershipFactory extends Factory<
  ReviewCampaignMembershipFixture,
  ReviewCampaignMembershipTransientParams
> {
  tester() {
    return this.params({ role: "tester" })
  }

  reviewer() {
    return this.params({ role: "reviewer" })
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
    } satisfies ReviewCampaignMembershipFixture
  },
)

/**
 * Saves a review-campaign membership to `user_membership`.
 */
export const saveReviewCampaignMembership = async ({
  repositories,
  membership,
}: {
  repositories: AllRepositories
  membership: ReviewCampaignMembershipFixture
}) => {
  const saved = await repositories.userMembershipRepository.save(
    userMembershipFactory.build({
      id: membership.id,
      userId: membership.userId,
      resourceType: "review_campaign",
      resourceId: membership.campaignId,
      role: membership.role,
    }),
  )
  return { ...membership, id: saved.id }
}
