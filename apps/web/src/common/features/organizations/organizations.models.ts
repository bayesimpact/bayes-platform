import type {
  UserOrganizationListItemDto,
  UserOrganizationListItemProjectDto,
} from "@caseai-connect/api-contracts"

export type OrganizationListItemProject = UserOrganizationListItemProjectDto

export type OrganizationListItem = UserOrganizationListItemDto

/** Alias used across UI components that display the organization list. */
export type Organization = OrganizationListItem
