import type { TimeType } from "../generic"
import type { MembershipRoleDto } from "../rbac/membership-role.dto"

/** Roles a member can be switched between. The owner role is never assigned or taken away here. */
export type EditableProjectMembershipRoleDto = "admin" | "member"

/**
 * A person with access to a project, with every role they hold on it. `id` is the oldest of
 * their membership rows on the project, and the routes below accept any of them.
 */
export type ProjectMembershipDto = {
  id: string
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
