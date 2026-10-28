import type { Project } from "@/domains/projects/project.entity"
import type { PROJECT_ROLES } from "@/domains/rbac/rbac.constants"
import type { User } from "@/domains/users/user.entity"

/** A `project_*` catalog role key (`PROJECT_ROLES`). */
export type ProjectRoleKey = (typeof PROJECT_ROLES)[keyof typeof PROJECT_ROLES]

/** Plain-object shape used by test factories before persistence. */
export type ProjectMembershipFixture = {
  id: string
  userId: string
  projectId: string
  /** One `user_membership` row per role key. */
  roleKeys: ProjectRoleKey[]
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  user: User
  project: Project
}
