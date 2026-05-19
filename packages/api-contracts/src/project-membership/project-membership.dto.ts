import type { TimeType } from "../generic"

export type ProjectMembershipRoleDto = "owner" | "admin" | "member"
export type ProjectMembershipDto = {
  id: string
  projectId: string
  userId: string
  userName: string | null
  userEmail: string
  createdAt: TimeType
  role: ProjectMembershipRoleDto
}
