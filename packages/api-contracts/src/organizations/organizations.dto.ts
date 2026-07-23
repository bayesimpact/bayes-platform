import { z } from "zod"
import type { TimeType } from "../generic"
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
  permissions: OrganizationPermission[]
}

export const updateOrganizationSchema = z
  .object({
    name: z.string().min(3).max(100).trim(),
  })
  .strict()

export type UpdateOrganizationRequestDto = z.infer<typeof updateOrganizationSchema>
