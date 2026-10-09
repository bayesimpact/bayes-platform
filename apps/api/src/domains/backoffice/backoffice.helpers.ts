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
import type { OrganizationMembershipModel } from "@/domains/organizations/memberships/organization-membership.model"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { ProjectMembershipModel } from "@/domains/projects/memberships/project-membership.model"
import type { Project } from "@/domains/projects/project.entity"
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
        role: membership.role,
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
        role: membership.role,
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

export function toBackofficeProjectDetailDto(
  project: Project & { organization?: { name: string } },
  members: ProjectMembershipModel[],
  agents: Agent[],
): BackofficeProjectDetailDto {
  return {
    id: project.id,
    name: project.name,
    organizationId: project.organizationId,
    organizationName: project.organization?.name ?? "",
    createdAt: project.createdAt.getTime() as TimeType,
    featureFlags: toFeatureFlagsDto(project.featureFlags),
    members: members.map(
      (membership): BackofficeProjectMemberDto => ({
        userId: membership.userId,
        userEmail: membership.user?.email ?? "",
        userName: membership.user?.name ?? null,
        role: membership.role,
      }),
    ),
    agents: agents.map(
      (agent): BackofficeProjectAgentDto => ({
        id: agent.id,
        name: agent.name,
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
  roleGrant: RoleGrant | undefined,
): BackofficeUserOrganizationMembershipDto {
  return {
    organizationId: membership.organizationId,
    organizationName: membership.organization?.name ?? "",
    role: membership.role,
    roleKey: roleGrant?.key ?? null,
    permissions: roleGrant?.permissions ?? [],
  }
}

export function toBackofficeUserProjectMembershipDto(
  membership: ProjectMembershipModel,
  roleGrant: RoleGrant | undefined,
): BackofficeUserProjectMembershipDto {
  return {
    projectId: membership.projectId,
    projectName: membership.project?.name ?? "",
    role: membership.role,
    roleKey: roleGrant?.key ?? null,
    permissions: roleGrant?.permissions ?? [],
  }
}

export function toBackofficeUserAgentMembershipDto(
  membership: AgentMembershipModel,
  roleGrant: RoleGrant | undefined,
): BackofficeUserAgentMembershipDto {
  return {
    agentId: membership.agentId,
    agentName: membership.agent?.name ?? "",
    role: membership.role,
    roleKey: roleGrant?.key ?? null,
    permissions: roleGrant?.permissions ?? [],
  }
}

export function toBackofficeUserReviewCampaignMembershipDto(
  membership: ReviewCampaignMembershipModel,
): BackofficeUserReviewCampaignMembershipDto {
  return {
    campaignId: membership.campaignId,
    campaignName: membership.campaign?.name ?? "",
    role: membership.role,
  }
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
      toBackofficeUserOrganizationMembershipDto(
        membership,
        membership.roleId ? roleGrantsByRoleId.get(membership.roleId) : undefined,
      ),
    ),
    projectMemberships: projectMemberships.map((membership) =>
      toBackofficeUserProjectMembershipDto(
        membership,
        membership.roleId ? roleGrantsByRoleId.get(membership.roleId) : undefined,
      ),
    ),
    agentMemberships: agentMemberships.map((membership) =>
      toBackofficeUserAgentMembershipDto(
        membership,
        membership.roleId ? roleGrantsByRoleId.get(membership.roleId) : undefined,
      ),
    ),
    reviewCampaignMemberships: reviewCampaignMemberships.map(
      toBackofficeUserReviewCampaignMembershipDto,
    ),
  }
}
