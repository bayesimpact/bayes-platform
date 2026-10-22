import { z } from "zod"
import type { TimeType } from "../generic"
import type { MembershipRoleDto } from "../rbac/membership-role.dto"

/** Roles a member can be switched between. The owner role is never assigned or taken away here. */
export type EditableProjectMembershipRoleDto = "admin" | "member"

/**
 * A person with access to a project, with every role they hold on it. A member is identified by
 * the project and `userId`; each role carries the id of the row that holds it.
 */
export type ProjectMembershipDto = {
  projectId: string
  userId: string
  userName: string | null
  userEmail: string
  /** False while the member was added by email and has never signed in. */
  userHasSignedIn: boolean
  createdAt: TimeType
  roles: MembershipRoleDto[]
  /** Permission keys the roles grant on the project, together. */
  permissions: string[]
}

export type UpdateProjectMembershipRequestDto = {
  role: EditableProjectMembershipRoleDto
}

/** A role of the RBAC catalog that can be given on a workspace (`scope_type = project`). */
export type ProjectRoleDto = {
  key: string
  name: string
}

/** How many members one bulk call can act on. */
export const MAX_MEMBERS_PER_BULK_ACTION = 200

const bulkUserIdsSchema = z
  .array(z.string().uuid())
  .min(1)
  .max(MAX_MEMBERS_PER_BULK_ACTION)
  .refine((userIds) => new Set(userIds).size === userIds.length, "User ids must be unique")

/** Gives the roles to every member listed. All or nothing: one refusal changes nobody. */
export const addProjectMemberRolesSchema = z.object({
  userIds: bulkUserIdsSchema,
  roleKeys: z.array(z.string().min(1)).min(1).max(20),
})
export type AddProjectMemberRolesRequestDto = z.infer<typeof addProjectMemberRolesSchema>

/** Removes every member listed from the workspace. All or nothing: one refusal removes nobody. */
export const deleteProjectMembersSchema = z.object({
  userIds: bulkUserIdsSchema,
})
export type DeleteProjectMembersRequestDto = z.infer<typeof deleteProjectMembersSchema>
