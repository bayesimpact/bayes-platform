import type { OrganizationDto, OrganizationPermission } from "@caseai-connect/api-contracts"
import type { Organization } from "./organization.entity"
import type { OrganizationModel } from "./organization.model"

export function toDto(organization: OrganizationModel): OrganizationDto {
  return {
    id: organization.id,
    name: organization.name,
    permissions: organization.permissions,
    createdAt: organization.createdAt,
  }
}

export function toModel(
  organization: Organization,
  permissions: OrganizationPermission[],
): OrganizationModel {
  return {
    id: organization.id,
    name: organization.name,
    permissions: permissions,
    createdAt: organization.createdAt.getTime(),
  }
}
