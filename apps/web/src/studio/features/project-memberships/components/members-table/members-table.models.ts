import type { TimeType } from "@caseai-connect/api-contracts"

import type { ProjectRole } from "../../project-memberships.models"

/** A role of the RBAC catalog whose `scope_type` is `project`. */
export type ProjectRoleOption = ProjectRole

/** A workspace member as the members table shows it, with every role they hold on the workspace. */
export type MembersTableMember = {
  userId: string
  userName: string | null
  userEmail: string
  /** False while the member was added by email and has never signed in. */
  userHasSignedIn: boolean
  createdAt: TimeType
  roles: ProjectRoleOption[]
}

/** The role a workspace must always keep on at least one member. */
export const PROJECT_OWNER_ROLE_KEY = "project_owner"
