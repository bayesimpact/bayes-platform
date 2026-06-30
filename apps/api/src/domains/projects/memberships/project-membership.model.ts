import type { Project } from "@/domains/projects/project.entity"
import type { User } from "@/domains/users/user.entity"
import type { ProjectMembershipRole } from "./project-membership.entity"

/**
 * Domain model for a project membership.
 *
 * This is a plain object — no TypeORM decorators — representing a project
 * membership record from the perspective of the service layer. The `project`
 * attribute is a TypeORM entity for now (pragmatic compromise during the
 * transition away from legacy tables); it will become a domain model once
 * ProjectEntity is also split.
 */
export type ProjectMembershipModel = {
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
