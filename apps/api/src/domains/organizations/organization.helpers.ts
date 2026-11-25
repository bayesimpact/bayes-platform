import type { OrganizationDto } from "@bayes-platform/api-contracts"
import type { OrganizationModel } from "./organization.model"

export function toDto(organization: OrganizationModel): OrganizationDto {
  return {
    id: organization.id,
    name: organization.name,
    permissions: organization.permissions,
    createdAt: organization.createdAt,
  }
}
