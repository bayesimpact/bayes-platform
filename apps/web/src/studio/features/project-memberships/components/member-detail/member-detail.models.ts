import type { ProjectRoleOption } from "../members-table/members-table.models"

/** A role of the RBAC catalog, offered on the resources whose type matches its `scope_type`. */
export type RoleOption = ProjectRoleOption

export type MemberResourceKind = "project" | "agent" | "review_campaign"

/**
 * One resource of the workspace and the member's roles on it. Storybook-first (#1077): the API
 * returns no such list yet.
 */
export type MemberResourceRoles = {
  kind: MemberResourceKind
  resourceId: string
  resourceName: string
  /** A short qualifier under the name: the agent's type, the campaign's status. */
  detail?: string
  roles: RoleOption[]
  /** The roles of this resource's `scope_type` the viewer may grant. */
  grantableRoles: RoleOption[]
  /** Whether the viewer may add or remove roles on this resource. */
  canManage: boolean
  /** Permission keys the member's roles grant on this resource. */
  permissions: string[]
}

export type MemberDetailMember = {
  id: string
  userId: string
  userName: string | null
  userEmail: string
  /** False while the member was added by email and has never signed in. */
  userHasSignedIn: boolean
}
