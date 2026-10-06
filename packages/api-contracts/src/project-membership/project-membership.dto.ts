import type { TimeType } from "../generic"

export type ProjectMembershipRoleDto = "owner" | "admin" | "member"
/** Roles a member can be switched between. The owner role is never assigned or taken away. */
export type EditableProjectMembershipRoleDto = Exclude<ProjectMembershipRoleDto, "owner">
export type ProjectMembershipDto = {
  id: string
  projectId: string
  userId: string
  userName: string | null
  userEmail: string
  /** False while the member was added by email and has never signed in. */
  userHasSignedIn: boolean
  createdAt: TimeType
  role: ProjectMembershipRoleDto
  /** Permission keys the role grants on the project. */
  permissions: string[]
}

export type UpdateProjectMembershipRequestDto = {
  role: EditableProjectMembershipRoleDto
}
