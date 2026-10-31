import { randomUUID } from "node:crypto"
import { Factory } from "fishery"
import type { RequiredScopeTransientParams } from "@/common/entities/connect-required-fields"
import type { AllRepositories } from "@/common/test/test-transaction-manager"
import { saveRoleGrantRows } from "@/domains/memberships/role-grant.factory"
import { addUserToOrganization } from "@/domains/organizations/memberships/organization-membership.factory"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { Project } from "@/domains/projects/project.entity"
import { ORGANIZATION_ROLES, REVIEW_CAMPAIGN_ROLES } from "@/domains/rbac/rbac.constants"
import type { User } from "@/domains/users/user.entity"
import type { ReviewCampaign } from "../review-campaign.entity"
import type {
  ReviewCampaignMembershipFixture,
  ReviewCampaignRoleKey,
} from "./review-campaign-membership.types"

type ReviewCampaignMembershipTransientParams = RequiredScopeTransientParams & {
  campaign: ReviewCampaign
  user: User
}

class ReviewCampaignMembershipFactory extends Factory<
  ReviewCampaignMembershipFixture,
  ReviewCampaignMembershipTransientParams
> {
  withRoles(...roleKeys: ReviewCampaignRoleKey[]) {
    return this.params({ roleKeys })
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
      roleKeys: (params.roleKeys as ReviewCampaignRoleKey[] | undefined) ?? [
        REVIEW_CAMPAIGN_ROLES.tester,
      ],
    } satisfies ReviewCampaignMembershipFixture
  },
)

/**
 * Saves a review-campaign membership to `role_grant`, one row per role key. Requires the RBAC
 * catalog (`ensureRbacCatalog`), so a spec never depends on which spec seeded the database first.
 */
export const saveReviewCampaignMembership = async ({
  repositories,
  membership,
}: {
  repositories: AllRepositories
  membership: ReviewCampaignMembershipFixture
}) => {
  await saveRoleGrantRows({
    repositories,
    id: membership.id,
    userId: membership.userId,
    resourceType: "review_campaign",
    resourceId: membership.campaignId,
    roleKeys: membership.roleKeys,
  })
  return membership
}

/**
 * Adds a new person to a review campaign the way accepting a campaign invitation does: an
 * organization member row and the campaign row with its RBAC role, and no project row.
 */
export const addUserToReviewCampaign = async ({
  repositories,
  organization,
  project,
  campaign,
  roleKeys = [REVIEW_CAMPAIGN_ROLES.tester],
  user,
}: {
  repositories: AllRepositories
  organization: Organization
  project: Project
  campaign: ReviewCampaign
  roleKeys?: ReviewCampaignRoleKey[]
  user?: Partial<User>
}) => {
  const { user: newUser } = await addUserToOrganization({
    repositories,
    organization,
    user,
    membership: { roleKeys: [ORGANIZATION_ROLES.member] },
  })
  const membership = await saveReviewCampaignMembership({
    repositories,
    membership: reviewCampaignMembershipFactory
      .transient({ organization, project, campaign, user: newUser })
      .build({ roleKeys }),
  })
  return { user: newUser, membership }
}
