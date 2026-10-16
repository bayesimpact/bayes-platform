/**
 * `temp_agent` holds agent roles a person gets on top of their single agent role (today only
 * `agent_conversation_reviewer`). Its id is the agent's id. It is a stopgap while the team decides
 * whether `user_membership` should allow several roles per person on one agent: it has no parent
 * and passes nothing down, so it never mixes with the `agent` rows.
 *
 * `review_campaign` holds the tester and reviewer roles of one campaign. Its id is the campaign's
 * id. Its only parent is the campaign's project, which passes down `review_campaign.report.read`.
 */
export type PermissionResourceType =
  | "organization"
  | "project"
  | "agent"
  | "temp_agent"
  | "review_campaign"

export type PermissionResource = {
  type: PermissionResourceType
  id: string
}

export type RoleGrant = {
  key: string
  name: string
  permissions: string[]
}
