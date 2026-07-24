import type { OrganizationDto } from "@caseai-connect/api-contracts"

/** Organization the current user can access, with their effective permissions. */
export type Organization = Omit<OrganizationDto, "createdAt">
