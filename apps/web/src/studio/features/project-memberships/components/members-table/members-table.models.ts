import type { TimeType } from "@caseai-connect/api-contracts"

/** A role of the RBAC catalog whose `scope_type` is `project`. */
export type ProjectRoleOption = {
  key: string
  name: string
}

/**
 * A workspace member as the members table shows it, with every role they hold on the workspace.
 * Storybook-first (#1076): the API still returns one role per member until #985.
 */
export type MembersTableMember = {
  id: string
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
