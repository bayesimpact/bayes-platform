import type { MembershipRole } from "@/domains/memberships/membership-roles"
import type { User } from "@/domains/users/user.entity"
import type { ReviewCampaign } from "../review-campaign.entity"
import type { ReviewCampaignMembershipRole } from "../review-campaigns.types"

/**
 * Domain model for a review-campaign membership: one role on the campaign, one
 * `user_membership` row. A person who is both tester and reviewer has two.
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
  /** Read from the row's `review_campaign_*` RBAC role. */
  role: ReviewCampaignMembershipRole
  membershipRole: MembershipRole
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  user: User
  campaign: ReviewCampaign
}
