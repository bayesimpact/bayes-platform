import type { AllRepositories } from "@/common/test/test-all-repositories"
import type { UserMembershipResourceType } from "@/domains/memberships/user-membership.entity"
import type { ReviewCampaignRoleKey } from "@/domains/review-campaigns/memberships/review-campaign-membership.types"

/**
 * The person's rows on a resource, read from `role_id`: the oldest row and every role key they
 * hold, or only the rows holding `roleKey` when given. Null without a row.
 */
export async function findUserMembershipRow({
  repositories,
  userId,
  resourceType,
  resourceId,
  roleKey,
}: {
  repositories: AllRepositories
  userId: string
  resourceType: UserMembershipResourceType
  resourceId: string
  roleKey?: string
}) {
  const rows = await repositories.userMembershipRepository.find({
    where: { userId, resourceType, resourceId },
    relations: { rbacRole: true },
    order: { createdAt: "ASC" },
  })
  const matchingRows = roleKey ? rows.filter((row) => row.rbacRole?.key === roleKey) : rows
  const [oldest] = matchingRows
  if (!oldest) return null

  const roleKeys = matchingRows.flatMap((row) => (row.rbacRole ? [row.rbacRole.key] : []))
  return { ...oldest, roleKeys }
}

export async function findOrganizationMembershipRow(
  repositories: AllRepositories,
  params: { userId: string; organizationId: string },
) {
  return findUserMembershipRow({
    repositories,
    userId: params.userId,
    resourceType: "organization",
    resourceId: params.organizationId,
  })
}

export async function findProjectMembershipRow(
  repositories: AllRepositories,
  params: { userId: string; projectId: string },
) {
  return findUserMembershipRow({
    repositories,
    userId: params.userId,
    resourceType: "project",
    resourceId: params.projectId,
  })
}

export async function findAgentMembershipRow(
  repositories: AllRepositories,
  params: { userId: string; agentId: string },
) {
  return findUserMembershipRow({
    repositories,
    userId: params.userId,
    resourceType: "agent",
    resourceId: params.agentId,
  })
}

export async function findReviewCampaignMembershipRow(
  repositories: AllRepositories,
  params: { userId: string; campaignId: string; roleKey?: ReviewCampaignRoleKey },
) {
  return findUserMembershipRow({
    repositories,
    userId: params.userId,
    resourceType: "review_campaign",
    resourceId: params.campaignId,
    roleKey: params.roleKey,
  })
}
