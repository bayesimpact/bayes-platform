import type { User } from "@/domains/users/user.entity"
import type { ReviewCampaign } from "../review-campaign.entity"
import type { ReviewCampaignMembershipRole } from "../review-campaigns.types"

/** Plain-object shape used by test factories before persistence. */
export type ReviewCampaignMembershipFixture = {
  id: string
  userId: string
  campaignId: string
  organizationId: string
  projectId: string
  role: ReviewCampaignMembershipRole
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  user: User
  campaign: ReviewCampaign
}
