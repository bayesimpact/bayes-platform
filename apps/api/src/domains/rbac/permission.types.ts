/**
 * `temp_agent` holds agent roles a person gets on top of their single agent role (today only
 * `agent_conversation_reviewer`). Its id is the agent's id. It is a stopgap while the team decides
 * whether `user_membership` should allow several roles per person on one agent: it has no parent
 * and passes nothing down, so it never mixes with the `agent` rows.
 */
export type PermissionResourceType = "organization" | "project" | "agent" | "temp_agent"

export type PermissionResource = {
  type: PermissionResourceType
  id: string
}

export type RoleGrant = {
  key: string
  name: string
  permissions: string[]
}
