import type {
  BackofficeOrganizationDto,
  BackofficeProjectAgentDto,
  BackofficeProjectDetailDto,
  BackofficeProjectDto,
  BackofficeProjectListItemDto,
  BackofficeProjectMemberDto,
  BackofficeUserAgentMembershipDto,
  BackofficeUserDetailDto,
  BackofficeUserDto,
  BackofficeUserOrganizationMembershipDto,
  BackofficeUserProjectMembershipDto,
  FeatureFlagKey,
  FeatureFlagsDto,
  TimeType,
} from "@caseai-connect/api-contracts"
import type { Agent } from "@/domains/agents/agent.entity"
import type { AgentMembership } from "@/domains/agents/memberships/agent-membership.entity"
import type { FeatureFlag } from "@/domains/feature-flags/feature-flag.entity"
import type { OrganizationMembership } from "@/domains/organizations/memberships/organization-membership.entity"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { ProjectMembership } from "@/domains/projects/memberships/project-membership.entity"
import type { Project } from "@/domains/projects/project.entity"
import type { User } from "@/domains/users/user.entity"

export type BackofficeOrganizationView = Omit<Organization, "projects"> & {
  projects: Project[]
}

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

export function toBackofficeOrganizationDto(
  organization: BackofficeOrganizationView,
): BackofficeOrganizationDto {
  return {
    id: organization.id,
    name: organization.name,
    createdAt: organization.createdAt.getTime() as TimeType,
    projects: organization.projects.map(toBackofficeProjectDto),
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
  }
}

export function toBackofficeProjectDetailDto(
  project: Project & { organization?: { name: string } },
  members: ProjectMembership[],
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
  membership: OrganizationMembership,
): BackofficeUserOrganizationMembershipDto {
  return {
    organizationId: membership.organizationId,
    organizationName: membership.organization?.name ?? "",
    role: membership.role,
  }
}

export function toBackofficeUserProjectMembershipDto(
  membership: ProjectMembership,
): BackofficeUserProjectMembershipDto {
  return {
    projectId: membership.projectId,
    projectName: membership.project?.name ?? "",
    role: membership.role,
  }
}

export function toBackofficeUserAgentMembershipDto(
  membership: AgentMembership,
): BackofficeUserAgentMembershipDto {
  return {
    agentId: membership.agentId,
    agentName: membership.agent?.name ?? "",
    role: membership.role,
  }
}

export function toBackofficeUserDetailDto(
  user: User,
  organizationMemberships: OrganizationMembership[],
  projectMemberships: ProjectMembership[],
  agentMemberships: AgentMembership[],
): BackofficeUserDetailDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.getTime() as TimeType,
    organizationMemberships: organizationMemberships.map(toBackofficeUserOrganizationMembershipDto),
    projectMemberships: projectMemberships.map(toBackofficeUserProjectMembershipDto),
    agentMemberships: agentMemberships.map(toBackofficeUserAgentMembershipDto),
  }
}
