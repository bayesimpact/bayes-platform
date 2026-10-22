import type { MembershipRole } from "@/domains/memberships/membership-roles"
import type { Project } from "@/domains/projects/project.entity"
import type { RoleGrant } from "@/domains/rbac/permission.types"
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
 * This is a plain object — no TypeORM decorators. The person and the project identify it; each
 * role carries the id of its row. The `project`
 * attribute is a TypeORM entity for now (pragmatic compromise during the transition away from
 * legacy tables); it will become a domain model once ProjectEntity is also split.
 */
export type ProjectMembershipModel = ProjectMembershipContextModel & {
  /** When the person got their first role on the project. */
  createdAt: Date
  updatedAt: Date
  user: User
  project: Project
}

/** One resource of the project, and a member's roles on it. */
export type MemberResourceRoles = {
  kind: "project" | "agent" | "review_campaign"
  resourceId: string
  resourceName: string
  /** The agent's type, or the campaign's status. */
  detail: string | null
  roles: MembershipRole[]
  /** What the member's roles grant on this resource, together. */
  permissions: string[]
  /** Whether the viewer may add or remove the member's roles on this resource. */
  canManage: boolean
}

/** A member's roles on the project, its agents and its review campaigns. */
export type MemberRoles = {
  membership: ProjectMembershipModel
  roleGrantsByRoleId: Map<string, RoleGrant>
  workspace: MemberResourceRoles
  agents: MemberResourceRoles[]
  campaigns: MemberResourceRoles[]
  assignableRoles: Record<MemberResourceRoles["kind"], { key: string; name: string }[]>
}
