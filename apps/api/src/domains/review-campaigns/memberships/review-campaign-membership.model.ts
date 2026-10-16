import type { User } from "@/domains/users/user.entity"
import type { ReviewCampaign } from "../review-campaign.entity"
import type { ReviewCampaignMembershipRole } from "../review-campaigns.types"

/**
 * Domain model for a review-campaign membership.
 *
 * Plain object returned to the service layer. `user` and `campaign` are TypeORM
 * entities for now (pragmatic compromise during the transition away from legacy
 * tables).
 */
export type ReviewCampaignMembershipModel = {
  id: string
  userId: string
  campaignId: string
  organizationId: string
  projectId: string
  role: ReviewCampaignMembershipRole
  /** The `review_campaign_*` RBAC role; null on a legacy row that never got one. */
  roleId: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  user: User
  campaign: ReviewCampaign
}
