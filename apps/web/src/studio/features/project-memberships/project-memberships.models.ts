import type { AgentType, TimeType } from "@caseai-connect/api-contracts"
import type { LegacyMembershipRole } from "@/common/features/memberships/membership-roles"

/** A role of the RBAC catalog that can be held on a workspace (`scope_type = project`). */
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

export type ProjectMemberAgent = {
  agentId: string
  agentName: string
  agentType: AgentType
  /** The highest of the member's agent roles, until this screen shows them all (#1077). */
  role: LegacyMembershipRole | null
  /** Permission keys the roles grant on the agent, empty without a membership. */
  permissions: string[]
}
