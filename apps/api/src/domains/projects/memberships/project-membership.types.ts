import type { Project } from "@/domains/projects/project.entity"
import type { User } from "@/domains/users/user.entity"

export type ProjectMembershipRole = "owner" | "admin" | "member"

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
