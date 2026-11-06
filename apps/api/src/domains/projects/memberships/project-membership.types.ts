import type { Project } from "@/domains/projects/project.entity"
import type { PROJECT_EVALUATOR_ROLE, PROJECT_ROLES } from "@/domains/rbac/rbac.constants"
import type { User } from "@/domains/users/user.entity"

/** A `project_*` catalog role key (`PROJECT_ROLES` and `PROJECT_EVALUATOR_ROLE`). */
export type ProjectRoleKey =
  | (typeof PROJECT_ROLES)[keyof typeof PROJECT_ROLES]
  | typeof PROJECT_EVALUATOR_ROLE

/** Plain-object shape used by test factories before persistence. */
export type ProjectMembershipFixture = {
  id: string
  userId: string
  projectId: string
  /** One `role_grant` row per role key. */
  roleKeys: ProjectRoleKey[]
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  user: User
  project: Project
}
