import type { Project } from "@/domains/projects/project.entity"
import type { User } from "@/domains/users/user.entity"

/** Shorthand for the `project_*` catalog roles (`PROJECT_ROLES`), used by test fixtures. */
export type ProjectMembershipRole = "owner" | "admin" | "member"

/** The roles a member can be switched between. */
export type EditableProjectMembershipRole = Exclude<ProjectMembershipRole, "owner">

/** Plain-object shape used by test factories before persistence. */
export type ProjectMembershipFixture = {
  id: string
  userId: string
  projectId: string
  role: ProjectMembershipRole
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  user: User
  project: Project
}
