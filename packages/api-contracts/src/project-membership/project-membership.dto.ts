import { z } from "zod"
import type { TimeType } from "../generic"
import type { MembershipRoleDto } from "../rbac/membership-role.dto"

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

/** The kinds of resource of a workspace a member can hold roles on. */
export type MemberResourceKindDto = "project" | "agent" | "review_campaign"

/** One resource of the workspace, and a member's roles on it. */
export type MemberResourceRolesDto = {
  kind: MemberResourceKindDto
  resourceId: string
  resourceName: string
  /** The agent's type, or the campaign's status. Null for the workspace. */
  detail: string | null
  roles: MembershipRoleDto[]
  /** Permission keys the member's roles grant on this resource, together. */
  permissions: string[]
  /** Whether the viewer may add or remove the member's roles on this resource. */
  canManage: boolean
}

/** A member's roles on the workspace, each of its agents and each of its review campaigns. */
export type ProjectMemberRolesDto = {
  member: ProjectMembershipDto
  workspace: MemberResourceRolesDto
  agents: MemberResourceRolesDto[]
  campaigns: MemberResourceRolesDto[]
  /** The roles of the catalog offered on each kind of resource. */
  assignableRoles: Record<MemberResourceKindDto, ProjectRoleDto[]>
}

/** One role to give a member on a resource. */
export const addMemberRoleSchema = z.object({
  roleKey: z.string().min(1),
})
export type AddMemberRoleRequestDto = z.infer<typeof addMemberRoleSchema>
