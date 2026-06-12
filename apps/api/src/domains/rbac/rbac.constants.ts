/**
 * Canonical role names persisted in the `role` table.
 *
 * Scope is conveyed via `user_role.conditions` (e.g. `{ organizationId: "<uuid>" }`),
 * not encoded in the role name. The role catalog is intentionally flat so that the
 * future CASL ability factory can read `(role.name, user_role.conditions)` and
 * project per-grant rules without name-parsing.
 */

export const ORGANIZATION_ROLES = ["org_owner", "org_admin", "org_member"] as const
export type OrganizationRoleName = (typeof ORGANIZATION_ROLES)[number]

export const PROJECT_ROLES = ["project_owner", "project_admin", "project_member"] as const
export type ProjectRoleName = (typeof PROJECT_ROLES)[number]

export const AGENT_ROLES = ["agent_owner", "agent_admin", "agent_member"] as const
export type AgentRoleName = (typeof AGENT_ROLES)[number]

export const CAMPAIGN_ROLES = ["campaign_tester", "campaign_reviewer"] as const
export type CampaignRoleName = (typeof CAMPAIGN_ROLES)[number]

export const ALL_RBAC_ROLES = [
  ...ORGANIZATION_ROLES,
  ...PROJECT_ROLES,
  ...AGENT_ROLES,
  ...CAMPAIGN_ROLES,
] as const
export type RbacRoleName = (typeof ALL_RBAC_ROLES)[number]
