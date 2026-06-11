import type {
  BackofficeOrganizationDto,
  BackofficeProjectDto,
  BackofficeProjectSessionCategoryDto,
  BackofficeUserDto,
  FeatureFlagKey,
  FeatureFlagsDto,
  TimeType,
} from "@caseai-connect/api-contracts"
import type { FeatureFlag } from "@/domains/feature-flags/feature-flag.entity"
import type { Organization } from "@/domains/organizations/organization.entity"
import type { Project } from "@/domains/projects/project.entity"
import type { User } from "@/domains/users/user.entity"

export type BackofficeProjectSessionCategoryView = {
  id: string
  name: string
  isUsedInConversation: boolean
}

export type BackofficeProjectView = Omit<Project, "projectSessionCategories"> & {
  projectSessionCategories?: BackofficeProjectSessionCategoryView[]
}

export type BackofficeOrganizationView = Omit<Organization, "projects"> & {
  projects: BackofficeProjectView[]
}

function toFeatureFlagsDto(featureFlags: FeatureFlag[] | undefined): FeatureFlagsDto {
  return (
    featureFlags
      ?.filter((flag) => flag.enabled)
      .map((flag) => flag.featureFlagKey as FeatureFlagKey) ?? []
  )
}

export function toBackofficeProjectSessionCategoryDto(
  projectSessionCategory: BackofficeProjectSessionCategoryView,
): BackofficeProjectSessionCategoryDto {
  return {
    id: projectSessionCategory.id,
    name: projectSessionCategory.name,
    isUsedInConversation: projectSessionCategory.isUsedInConversation,
  }
}

export function toBackofficeProjectDto(project: BackofficeProjectView): BackofficeProjectDto {
  return {
    id: project.id,
    name: project.name,
    organizationId: project.organizationId,
    createdAt: project.createdAt.getTime() as TimeType,
    updatedAt: project.updatedAt.getTime() as TimeType,
    featureFlags: toFeatureFlagsDto(project.featureFlags),
    agentSessionCategories: (project.projectSessionCategories ?? []).map(
      toBackofficeProjectSessionCategoryDto,
    ),
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
