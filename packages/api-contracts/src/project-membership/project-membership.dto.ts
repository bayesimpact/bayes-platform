import type { TimeType } from "../generic"

export type ProjectMembershipRoleDto = "owner" | "admin" | "member"
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
}
