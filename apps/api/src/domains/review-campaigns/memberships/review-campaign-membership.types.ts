import type { REVIEW_CAMPAIGN_ROLES } from "@/domains/rbac/rbac.constants"
import type { User } from "@/domains/users/user.entity"
import type { ReviewCampaign } from "../review-campaign.entity"

/** A `review_campaign_*` catalog role key (`REVIEW_CAMPAIGN_ROLES`). */
export type ReviewCampaignRoleKey =
  (typeof REVIEW_CAMPAIGN_ROLES)[keyof typeof REVIEW_CAMPAIGN_ROLES]

/** Plain-object shape used by test factories before persistence. */
export type ReviewCampaignMembershipFixture = {
  id: string
  userId: string
  campaignId: string
  organizationId: string
  projectId: string
  /** One `user_membership` row per role key. */
  roleKeys: ReviewCampaignRoleKey[]
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  user: User
  campaign: ReviewCampaign
}
