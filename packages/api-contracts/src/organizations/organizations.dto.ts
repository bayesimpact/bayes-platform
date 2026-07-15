import { z } from "zod"
import type { FeatureFlagsDto } from "../feature-flags/feature-flags.dto"
import type { TimeType } from "../generic"
import type { ProjectDto } from "../projects/projects.dto"
import type { OrganizationPermission } from "../rbac/permissions"

export type OrganizationMembershipRoleDto = "owner" | "admin" | "member"

export type OrganizationMembershipDto = {
  id: string
  organizationId: string
  userId: string
  role: OrganizationMembershipRoleDto
}

export type OrganizationDto = {
  id: string
  name: string
  createdAt: TimeType
  projects: ProjectDto[]
}

export type UserOrganizationListItemProjectDto = {
  id: string
  name: string
  featureFlags: FeatureFlagsDto
}

/** Slim organization row for GET /organizations. */
export type UserOrganizationListItemDto = {
  id: string
  name: string
  permissions: OrganizationPermission[]
  projects: UserOrganizationListItemProjectDto[]
}

export const updateOrganizationSchema = z
  .object({
    name: z.string().min(3).max(100).trim(),
  })
  .strict()

export type UpdateOrganizationRequestDto = z.infer<typeof updateOrganizationSchema>
