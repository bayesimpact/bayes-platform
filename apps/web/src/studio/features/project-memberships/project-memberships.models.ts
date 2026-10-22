import type { TimeType } from "@caseai-connect/api-contracts"

/** A role of the RBAC catalog that can be held on a workspace, an agent or a review campaign. */
export type ProjectRole = {
  key: string
  name: string
}

/** A person with access to the workspace, with every role they hold on it. */
export type ProjectMembership = {
  projectId: string
  userId: string
  userName: string | null
  userEmail: string
  /** False while the member was added by email and has never signed in. */
  userHasSignedIn: boolean
  createdAt: TimeType
  roles: ProjectRole[]
  /** Permission keys the roles grant on the project, together. */
  permissions: string[]
}

/** A role a member holds on a resource, with the membership row that holds it. */
export type HeldRole = ProjectRole & { membershipId: string }

/** The kinds of resource of a workspace a member can hold roles on. */
export type MemberResourceKind = "project" | "agent" | "review_campaign"

/** One resource of the workspace and the member's roles on it. */
export type MemberResource = {
  kind: MemberResourceKind
  resourceId: string
  resourceName: string
  /** The agent's type, or the campaign's status. */
  detail: string | null
  roles: HeldRole[]
  /** What the member's roles grant on this resource, together. */
  permissions: string[]
}

/** A member's roles on the workspace, its agents and its review campaigns. */
export type MemberRoles = {
  member: ProjectMembership
  workspace: MemberResource
  agents: MemberResource[]
  campaigns: MemberResource[]
}

/** The roles a member can be given on each kind of resource, in catalog order. */
export type AssignableRoles = Record<MemberResourceKind, ProjectRole[]>
