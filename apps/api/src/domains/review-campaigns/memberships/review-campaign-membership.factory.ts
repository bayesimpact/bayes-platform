import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { AllRepositories } from "@/common/test/test-transaction-manager"
import { userMembershipFactory } from "@/domains/memberships/user-membership.factory"
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

/**
 * Saves a ReviewCampaignMembership to both the legacy table and user_memberships.
 * Use this in tests instead of `repositories.reviewCampaignMembershipRepository.save()`
 * to keep user_memberships in sync during the dual-write transition period.
 */
export const saveReviewCampaignMembership = async ({
  repositories,
  membership,
}: {
  repositories: AllRepositories
  membership: ReviewCampaignMembership
}) => {
  const saved = await repositories.reviewCampaignMembershipRepository.save(membership)
  await repositories.userMembershipRepository.save(
    userMembershipFactory.build({
      userId: saved.userId,
      resourceType: "review_campaign",
      resourceId: saved.campaignId,
      role: saved.role,
    }),
  )
  return saved
}
