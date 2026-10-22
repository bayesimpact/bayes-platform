import type { AllRepositories } from "@/common/test/test-all-repositories"
import type { UserMembershipResourceType } from "@/domains/memberships/user-membership.entity"

/** Shorthand of a catalog role key: `project_admin` -> `admin`, `review_campaign_tester` -> `tester`. */
type RoleShorthand = "owner" | "admin" | "member" | "tester" | "reviewer"

const ROLE_RANK: RoleShorthand[] = ["owner", "admin", "member", "tester", "reviewer"]

function toShorthand(roleKey: string): RoleShorthand | null {
  const shorthand = ROLE_RANK.find((candidate) => roleKey.endsWith(`_${candidate}`))
  return shorthand ?? null
}

/**
 * The person's rows on a resource, read from `role_id`: the oldest row, every role key they hold,
 * and `role`, the shorthand of the highest one (owner, then admin, member, tester, reviewer).
 * Null without a row.
 */
export async function findUserMembershipRow({
  repositories,
  userId,
  resourceType,
  resourceId,
  role,
}: {
  repositories: AllRepositories
  userId: string
  resourceType: UserMembershipResourceType
  resourceId: string
  role?: RoleShorthand
}) {
  const rows = await repositories.userMembershipRepository.find({
    where: { userId, resourceType, resourceId },
    relations: { rbacRole: true },
    order: { createdAt: "ASC" },
  })
  const matchingRows = role
    ? rows.filter((row) => row.rbacRole && toShorthand(row.rbacRole.key) === role)
    : rows
  const [oldest] = matchingRows
  if (!oldest) return null

  const roleKeys = matchingRows.flatMap((row) => (row.rbacRole ? [row.rbacRole.key] : []))
  const shorthands = roleKeys.flatMap((roleKey) => toShorthand(roleKey) ?? [])
  const highest = ROLE_RANK.find((shorthand) => shorthands.includes(shorthand)) ?? null
  return { ...oldest, roleKeys, role: highest }
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
  params: { userId: string; campaignId: string; role?: "tester" | "reviewer" },
) {
  return findUserMembershipRow({
    repositories,
    userId: params.userId,
    resourceType: "review_campaign",
    resourceId: params.campaignId,
    role: params.role,
  })
}
