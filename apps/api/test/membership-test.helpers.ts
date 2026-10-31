import type { AllRepositories } from "@/common/test/test-all-repositories"
import type { RoleGrantResourceType } from "@/domains/memberships/role-grant.entity"
import type { ReviewCampaignRoleKey } from "@/domains/review-campaigns/memberships/review-campaign-membership.types"

/**
 * The person's rows on a resource, read from `role_id`: the oldest row and every role key they
 * hold, or only the rows holding `roleKey` when given. Null without a row.
 */
export async function findRoleGrantRow({
  repositories,
  userId,
  resourceType,
  resourceId,
  roleKey,
}: {
  repositories: AllRepositories
  userId: string
  resourceType: RoleGrantResourceType
  resourceId: string
  roleKey?: string
}) {
  const rows = await repositories.roleGrantRepository.find({
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
  return findRoleGrantRow({
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
  return findRoleGrantRow({
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
  return findRoleGrantRow({
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
  return findRoleGrantRow({
    repositories,
    userId: params.userId,
    resourceType: "review_campaign",
    resourceId: params.campaignId,
    roleKey: params.roleKey,
  })
}
