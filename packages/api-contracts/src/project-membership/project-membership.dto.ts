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
  /** RBAC role key backing the membership, null when the catalog is not seeded. */
  roleKey: string | null
  /** Permission keys the role grants on the project. */
  permissions: string[]
}
