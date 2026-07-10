import type { AllRepositories } from "@/common/test/test-all-repositories"
import type { UserMembershipResourceType } from "@/domains/memberships/user-membership.entity"

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
  role?: string
}) {
  return repositories.userMembershipRepository.findOne({
    where: {
      userId,
      resourceType,
      resourceId,
      ...(role ? { role } : {}),
    },
  })
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
  params: { userId: string; campaignId: string; role?: string },
) {
  return findUserMembershipRow({
    repositories,
    userId: params.userId,
    resourceType: "review_campaign",
    resourceId: params.campaignId,
    role: params.role,
  })
}
