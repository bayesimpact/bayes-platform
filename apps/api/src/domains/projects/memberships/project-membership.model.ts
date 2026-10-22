import type { MembershipRole } from "@/domains/memberships/membership-roles"
import type { Project } from "@/domains/projects/project.entity"
import type { User } from "@/domains/users/user.entity"

/**
 * What `ProjectContextResolver` puts on the request for the caller: who they are on the project
 * and the roles they hold there. No row id or dates: a person can hold several `user_membership`
 * rows on one project (one per role), and nothing reads them here.
 */
export type ProjectMembershipContextModel = {
  userId: string
  projectId: string
  /** Every role the person holds on the project, one `user_membership` row each. */
  roles: MembershipRole[]
}

/**
 * Domain model for a person's membership in a project: every role they hold on it, one
 * `user_membership` row each.
 *
 * This is a plain object — no TypeORM decorators. `id` is the oldest row's id. The `project`
 * attribute is a TypeORM entity for now (pragmatic compromise during the transition away from
 * legacy tables); it will become a domain model once ProjectEntity is also split.
 */
export type ProjectMembershipModel = ProjectMembershipContextModel & {
  /** The oldest of the person's rows on the project. */
  id: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  user: User
  project: Project
}
