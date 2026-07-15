import type {
  FeatureFlagKey,
  OrganizationDto,
  UserOrganizationListItemDto,
} from "@caseai-connect/api-contracts"
import { toProjectDto } from "../projects/helpers"
import type { Project } from "../projects/project.entity"
import type { Organization } from "./organization.entity"
import type { OrganizationModel } from "./organization.model"

export function toDto(organization: Organization, projects: Project[]): OrganizationDto {
  return {
    id: organization.id,
    name: organization.name,
    projects: projects.map(toProjectDto),
    createdAt: organization.createdAt.getTime(),
  }
}

export function toUserOrganizationListItemDto(
  organization: OrganizationModel,
): UserOrganizationListItemDto {
  return {
    id: organization.id,
    name: organization.name,
    permissions: organization.permissions as UserOrganizationListItemDto["permissions"],
    projects: organization.projects.map((project) => ({
      id: project.id,
      name: project.name,
      featureFlags: project.featureFlags as FeatureFlagKey[],
    })),
  }
}
