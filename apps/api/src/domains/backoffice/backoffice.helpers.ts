import type {
  BackofficeOrganizationDto,
  BackofficeProjectDto,
  BackofficeUserDto,
  FeatureFlagKey,
  FeatureFlagsDto,
  TimeType,
} from "@caseai-connect/api-contracts"
import type { FeatureFlag } from "@/domains/feature-flags/feature-flag.entity"
import type { Organization } from "@/domains/organizations/organization.entity"
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

export function toBackofficeUserDto(user: User): BackofficeUserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.getTime() as TimeType,
    organizationMemberships: (user.memberships ?? []).map((membership) => ({
      organizationId: membership.organizationId,
      organizationName: membership.organization?.name ?? "",
      role: membership.role,
    })),
    projectMemberships: (user.projectMemberships ?? []).map((membership) => ({
      projectId: membership.projectId,
      projectName: membership.project?.name ?? "",
      role: membership.role,
    })),
    agentMemberships: (user.agentMemberships ?? []).map((membership) => ({
      agentId: membership.agentId,
      agentName: membership.agent?.name ?? "",
      role: membership.role,
    })),
  }
}
