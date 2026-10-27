import type {
  BackofficeAgentDetailDto,
  BackofficeAgentListItemDto,
  BackofficeAgentMemberDto,
  BackofficeOrganizationDetailDto,
  BackofficeOrganizationDto,
  BackofficeOrganizationMemberDto,
  BackofficeOrganizationProjectDto,
  BackofficeProjectAgentDto,
  BackofficeProjectDetailDto,
  BackofficeProjectDto,
  BackofficeProjectListItemDto,
  BackofficeProjectMemberDto,
  BackofficeUserAgentMembershipDto,
  BackofficeUserDetailDto,
  BackofficeUserDto,
  BackofficeUserGlobalRoleDto,
  BackofficeUserOrganizationMembershipDto,
  BackofficeUserProjectMembershipDto,
  BackofficeUserReviewCampaignMembershipDto,
  FeatureFlagKey,
  FeatureFlagsDto,
  TimeType,
} from "@caseai-connect/api-contracts"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentConversationReviewerRecord } from "@/domains/agents/conversation-reviewers/agent-conversation-reviewer.repository"
import type { AgentMembershipModel } from "@/domains/agents/memberships/agent-membership.model"
import type { FeatureFlag } from "@/domains/feature-flags/feature-flag.entity"
import { toMembershipRoleDto, unionRolePermissions } from "@/domains/memberships/membership-roles"
import type { OrganizationMembershipModel } from "@/domains/organizations/memberships/organization-membership.model"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { ProjectMembershipModel } from "@/domains/projects/memberships/project-membership.model"
import type { Project } from "@/domains/projects/project.entity"
import type { ResourceIdsScope } from "@/domains/rbac/permission.service"
import type { RoleGrant } from "@/domains/rbac/permission.types"
import type { User } from "@/domains/users/user.entity"
import type { ReviewCampaignMembershipModel } from "../review-campaigns/memberships/review-campaign-membership.model"

function toFeatureFlagsDto(featureFlags: FeatureFlag[] | undefined): FeatureFlagsDto {
  return (
    featureFlags
      ?.filter((flag) => flag.enabled)
      .map((flag) => flag.featureFlagKey as FeatureFlagKey) ?? []
  )
}

export function toBackofficeProjectDto(project: Project): BackofficeProjectDto {
  return {
    id: project.id,
    name: project.name,
    organizationId: project.organizationId,
    createdAt: project.createdAt.getTime() as TimeType,
    updatedAt: project.updatedAt.getTime() as TimeType,
    featureFlags: toFeatureFlagsDto(project.featureFlags),
  }
}

export function toBackofficeOrganizationDto(organization: Organization): BackofficeOrganizationDto {
  return {
    id: organization.id,
    name: organization.name,
    createdAt: organization.createdAt.getTime() as TimeType,
  }
}

export function toBackofficeOrganizationDetailDto(
  organization: Organization,
  members: OrganizationMembershipModel[],
  projects: Project[],
): BackofficeOrganizationDetailDto {
  return {
    id: organization.id,
    name: organization.name,
    createdAt: organization.createdAt.getTime() as TimeType,
    members: members.map(
      (membership): BackofficeOrganizationMemberDto => ({
        userId: membership.userId,
        userEmail: membership.user?.email ?? "",
        userName: membership.user?.name ?? null,
        roles: membership.roles.map(toMembershipRoleDto),
      }),
    ),
    projects: projects.map(
      (project): BackofficeOrganizationProjectDto => ({
        id: project.id,
        name: project.name,
        featureFlags: toFeatureFlagsDto(project.featureFlags),
      }),
    ),
  }
}

export function toBackofficeAgentListItemDto(
  agent: Agent & { project?: { id: string; name: string } },
): BackofficeAgentListItemDto {
  return {
    id: agent.id,
    name: agent.name,
    projectId: agent.project?.id ?? "",
    projectName: agent.project?.name ?? "",
    createdAt: agent.createdAt.getTime() as TimeType,
  }
}

export function toBackofficeAgentDetailDto(
  agent: Agent & {
    project?: {
      id: string
      name: string
      organizationId?: string
      organization?: { id: string; name: string }
    }
  },
  members: AgentMembershipModel[],
  conversationReviewers: AgentConversationReviewerRecord[],
): BackofficeAgentDetailDto {
  return {
    id: agent.id,
    name: agent.name,
    projectId: agent.project?.id ?? "",
    projectName: agent.project?.name ?? "",
    organizationId: agent.project?.organization?.id ?? agent.project?.organizationId ?? "",
    organizationName: agent.project?.organization?.name ?? "",
    createdAt: agent.createdAt.getTime() as TimeType,
    conversationReviewers: conversationReviewers.map((reviewer) => ({
      userId: reviewer.userId,
      email: reviewer.email,
      name: reviewer.name,
      grantedAt: reviewer.grantedAt.getTime() as TimeType,
    })),
    members: members.map(
      (membership): BackofficeAgentMemberDto => ({
        userId: membership.userId,
        userEmail: membership.user?.email ?? "",
        userName: membership.user?.name ?? null,
        roles: membership.roles.map(toMembershipRoleDto),
      }),
    ),
  }
}

export function toBackofficeProjectListItemDto(
  project: Project & { organization?: { name: string } },
): BackofficeProjectListItemDto {
  return {
    id: project.id,
    name: project.name,
    organizationId: project.organizationId,
    organizationName: project.organization?.name ?? "",
    createdAt: project.createdAt.getTime() as TimeType,
    featureFlags: toFeatureFlagsDto(project.featureFlags),
  }
}

export function toBackofficeProjectDetailDto({
  project,
  organizationPermissions,
  members,
  visibleUsers,
  agents,
}: {
  project: Project & { organization?: { name: string } }
  organizationPermissions: string[]
  members: ProjectMembershipModel[]
  visibleUsers: ResourceIdsScope
  agents: { agent: Agent; permissions: string[] }[]
}): BackofficeProjectDetailDto {
  return {
    id: project.id,
    name: project.name,
    organization: {
      id: project.organizationId,
      name: project.organization?.name ?? "",
      permissions: organizationPermissions,
    },
    createdAt: project.createdAt.getTime() as TimeType,
    featureFlags: toFeatureFlagsDto(project.featureFlags),
    members: members.map(
      (membership): BackofficeProjectMemberDto => ({
        userId: membership.userId,
        userEmail: membership.user?.email ?? "",
        userName: membership.user?.name ?? null,
        roles: membership.roles.map(toMembershipRoleDto),
        canRead: visibleUsers.scope === "all" || visibleUsers.ids.includes(membership.userId),
      }),
    ),
    agents: agents.map(
      ({ agent, permissions }): BackofficeProjectAgentDto => ({
        id: agent.id,
        name: agent.name,
        permissions,
      }),
    ),
  }
}

export function toBackofficeUserDto(user: User): BackofficeUserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.getTime() as TimeType,
  }
}

export function toBackofficeUserOrganizationMembershipDto(
  membership: OrganizationMembershipModel,
  roleGrantsByRoleId: ReadonlyMap<string, RoleGrant>,
): BackofficeUserOrganizationMembershipDto {
  return {
    organizationId: membership.organizationId,
    organizationName: membership.organization?.name ?? "",
    roles: membership.roles.map(toMembershipRoleDto),
    permissions: unionRolePermissions(membership.roles, roleGrantsByRoleId),
  }
}

export function toBackofficeUserProjectMembershipDto(
  membership: ProjectMembershipModel,
  roleGrantsByRoleId: ReadonlyMap<string, RoleGrant>,
): BackofficeUserProjectMembershipDto {
  return {
    projectId: membership.projectId,
    projectName: membership.project?.name ?? "",
    roles: membership.roles.map(toMembershipRoleDto),
    permissions: unionRolePermissions(membership.roles, roleGrantsByRoleId),
  }
}

export function toBackofficeUserAgentMembershipDto(
  membership: AgentMembershipModel,
  roleGrantsByRoleId: ReadonlyMap<string, RoleGrant>,
): BackofficeUserAgentMembershipDto {
  return {
    agentId: membership.agentId,
    agentName: membership.agent?.name ?? "",
    roles: membership.roles.map(toMembershipRoleDto),
    permissions: unionRolePermissions(membership.roles, roleGrantsByRoleId),
  }
}

/** One entry per campaign, in the order of `memberships`, with the user's roles on it. */
export function toBackofficeUserReviewCampaignMembershipDtos(
  memberships: ReviewCampaignMembershipModel[],
  roleGrantsByRoleId: ReadonlyMap<string, RoleGrant>,
): BackofficeUserReviewCampaignMembershipDto[] {
  const membershipsByCampaignId = new Map<string, ReviewCampaignMembershipModel[]>()
  for (const membership of memberships) {
    const campaignMemberships = membershipsByCampaignId.get(membership.campaignId)
    if (campaignMemberships) campaignMemberships.push(membership)
    else membershipsByCampaignId.set(membership.campaignId, [membership])
  }

  return [...membershipsByCampaignId.values()].flatMap((campaignMemberships) => {
    const [first] = campaignMemberships
    if (!first) return []
    const roles = campaignMemberships.map((membership) => membership.membershipRole)
    return [
      {
        campaignId: first.campaignId,
        campaignName: first.campaign?.name ?? "",
        projectId: first.projectId,
        roles: roles.map(toMembershipRoleDto),
        permissions: unionRolePermissions(roles, roleGrantsByRoleId),
      },
    ]
  })
}

export function toBackofficeUserGlobalRoleDto(roleGrant: RoleGrant): BackofficeUserGlobalRoleDto {
  return {
    key: roleGrant.key,
    name: roleGrant.name,
    permissions: roleGrant.permissions,
  }
}

export function toBackofficeUserDetailDto(
  user: User,
  globalRoles: RoleGrant[],
  organizationMemberships: OrganizationMembershipModel[],
  projectMemberships: ProjectMembershipModel[],
  agentMemberships: AgentMembershipModel[],
  reviewCampaignMemberships: ReviewCampaignMembershipModel[],
  roleGrantsByRoleId: Map<string, RoleGrant>,
): BackofficeUserDetailDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.getTime() as TimeType,
    globalRoles: globalRoles.map(toBackofficeUserGlobalRoleDto),
    organizationMemberships: organizationMemberships.map((membership) =>
      toBackofficeUserOrganizationMembershipDto(membership, roleGrantsByRoleId),
    ),
    projectMemberships: projectMemberships.map((membership) =>
      toBackofficeUserProjectMembershipDto(membership, roleGrantsByRoleId),
    ),
    agentMemberships: agentMemberships.map((membership) =>
      toBackofficeUserAgentMembershipDto(membership, roleGrantsByRoleId),
    ),
    reviewCampaignMemberships: toBackofficeUserReviewCampaignMembershipDtos(
      reviewCampaignMemberships,
      roleGrantsByRoleId,
    ),
  }
}
