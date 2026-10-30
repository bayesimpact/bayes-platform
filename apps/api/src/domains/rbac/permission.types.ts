/**
 * A person can hold several roles on one resource, one `user_membership` row each, and their
 * permissions on it are the union of those roles (ADR 0032).
 *
 * `review_campaign` holds the tester and reviewer roles of one campaign. Its id is the campaign's
 * id. Its only parent is the campaign's project, which passes down `review_campaign.report.read`.
 */
export type PermissionResourceType = "organization" | "project" | "agent" | "review_campaign"

export type PermissionResource = {
  type: PermissionResourceType
  id: string
}

/** A catalog role with its permission keys, held by no one in particular. */
export type ResolvedRole = {
  key: string
  name: string
  permissions: string[]
}
