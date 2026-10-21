import type { MembershipRole } from "@/domains/memberships/membership-roles"
import type { Project } from "@/domains/projects/project.entity"
import type { User } from "@/domains/users/user.entity"

/**
 * Domain model for a person's membership in a project: every role they hold on it, one
 * `user_membership` row each.
 *
 * This is a plain object — no TypeORM decorators. `id` is the oldest row's id. The `project`
 * attribute is a TypeORM entity for now (pragmatic compromise during the transition away from
 * legacy tables); it will become a domain model once ProjectEntity is also split.
 */
export type ProjectMembershipModel = {
  id: string
  userId: string
  projectId: string
  roles: MembershipRole[]
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  user: User
  project: Project
}
