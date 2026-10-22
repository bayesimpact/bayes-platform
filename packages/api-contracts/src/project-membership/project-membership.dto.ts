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
