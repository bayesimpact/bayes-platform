import type { QueryRunner } from "typeorm"
import type { RbacRoleName } from "./rbac.constants"

/**
 * Phase-3 permission catalog: every (role, action, subject) triple the policy
 * layer currently grants. The single source of truth — both
 * `seed-rbac-permission-catalog` migration and the `clearTestDatabase` reseed
 * use this constant. The frozen audit doc is `docs/rbac-permission-catalog.md`.
 *
 * Rules encode current behaviour verbatim (including known FIXMEs in the
 * policy code). Bug fixes ship as separate PRs after Phase 3 lands.
 */

/** All CASL subjects. 19 policy-backed + 1 catalog-only (`ReviewCampaignMembership`). */
export const APP_SUBJECTS = [
  "Project",
  "Agent",
  "Organization",
  "Document",
  "DocumentTag",
  "Evaluation",
  "EvaluationExtractionDataset",
  "EvaluationExtractionRun",
  "EvaluationReport",
  "Invitation",
  "ProjectMembership",
  "AgentMembership",
  "ReviewCampaignMembership",
  "ReviewCampaign",
  "BaseAgentSession",
  "CampaignReport",
  "Reviewer",
  "Tester",
  "AgentsAnalytics",
  "ProjectsAnalytics",
] as const
export type AppSubject = (typeof APP_SUBJECTS)[number]

/**
 * CRUD plus three first-class non-CRUD action names:
 *   - `review`: reviewer write-time gate.
 *   - `actAsTester`: tester action gate (collapsed CRUD on `Tester`).
 *   - `viewSharedContext`: shared campaign-landing read (dual-role OR).
 */
export const APP_ACTIONS = [
  "list",
  "read",
  "create",
  "update",
  "delete",
  "review",
  "actAsTester",
  "viewSharedContext",
] as const
export type AppAction = (typeof APP_ACTIONS)[number]

/**
 * One row per granted (role, action, subject) triple. `conditions` carries
 * RULE-level filters (subject attributes like `status`, `type`, `targetType`,
 * `sourceType`) — never scope ids (`organizationId`, `projectId`, …) which
 * live on `user_role.conditions` and merge in at AbilityFactory build time.
 *
 * `fields` and `inverted` are CASL passthroughs — unused at Phase-3 land,
 * reserved for future column-level rules / `cannot` rules.
 */
export type CatalogRule = {
  role: RbacRoleName
  action: AppAction
  subject: AppSubject
  conditions?: Record<string, unknown> | null
  fields?: string[] | null
  inverted?: boolean
  reason?: string | null
}

/**
 * The catalog itself. Grouped by subject for readability; ordering is not
 * semantically meaningful. See `docs/rbac-permission-catalog.md` §4 for the
 * authoritative truth-table and condition-shape commentary.
 */
export const RBAC_CATALOG: readonly CatalogRule[] = [
  // --- Project ---------------------------------------------------------------
  { role: "org_owner", action: "list", subject: "Project" },
  { role: "org_admin", action: "list", subject: "Project" },
  { role: "org_member", action: "list", subject: "Project" },
  { role: "org_owner", action: "create", subject: "Project" },
  { role: "org_admin", action: "create", subject: "Project" },
  { role: "project_owner", action: "update", subject: "Project" },
  { role: "project_admin", action: "update", subject: "Project" },
  { role: "project_owner", action: "delete", subject: "Project" },
  { role: "project_admin", action: "delete", subject: "Project" },

  // --- Agent -----------------------------------------------------------------
  // canList: any project member (so org/project/agent owners all qualify via their project grant).
  { role: "project_owner", action: "list", subject: "Agent" },
  { role: "project_admin", action: "list", subject: "Agent" },
  { role: "project_member", action: "list", subject: "Agent" },
  { role: "project_owner", action: "create", subject: "Agent" },
  { role: "project_admin", action: "create", subject: "Agent" },
  { role: "agent_owner", action: "update", subject: "Agent" },
  { role: "agent_admin", action: "update", subject: "Agent" },
  { role: "agent_owner", action: "delete", subject: "Agent" },
  { role: "agent_admin", action: "delete", subject: "Agent" },

  // --- Organization ----------------------------------------------------------
  // NOTE: `Organization.create` is gated by `process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN`,
  // NOT by an RBAC role — AbilityFactory injects it at runtime. Intentionally absent from the catalog.

  // --- Document --------------------------------------------------------------
  { role: "project_owner", action: "list", subject: "Document" },
  { role: "project_admin", action: "list", subject: "Document" },
  { role: "project_owner", action: "read", subject: "Document" },
  { role: "project_admin", action: "read", subject: "Document" },
  { role: "project_member", action: "read", subject: "Document" },
  { role: "project_owner", action: "create", subject: "Document" },
  { role: "project_admin", action: "create", subject: "Document" },
  {
    role: "project_member",
    action: "create",
    subject: "Document",
    conditions: { sourceType: { $in: ["agentSessionMessage", "extraction"] } },
    reason:
      "Members may create only documents sourced from their own agent sessions / extractions.",
  },
  { role: "project_owner", action: "update", subject: "Document" },
  { role: "project_admin", action: "update", subject: "Document" },
  { role: "project_owner", action: "delete", subject: "Document" },
  { role: "project_admin", action: "delete", subject: "Document" },

  // --- DocumentTag -----------------------------------------------------------
  { role: "project_owner", action: "list", subject: "DocumentTag" },
  { role: "project_admin", action: "list", subject: "DocumentTag" },
  { role: "project_owner", action: "create", subject: "DocumentTag" },
  { role: "project_admin", action: "create", subject: "DocumentTag" },
  { role: "project_owner", action: "update", subject: "DocumentTag" },
  { role: "project_admin", action: "update", subject: "DocumentTag" },
  { role: "project_owner", action: "delete", subject: "DocumentTag" },
  { role: "project_admin", action: "delete", subject: "DocumentTag" },

  // --- Evaluation ------------------------------------------------------------
  { role: "project_owner", action: "list", subject: "Evaluation" },
  { role: "project_admin", action: "list", subject: "Evaluation" },
  { role: "project_owner", action: "create", subject: "Evaluation" },
  { role: "project_admin", action: "create", subject: "Evaluation" },
  { role: "project_owner", action: "update", subject: "Evaluation" },
  { role: "project_admin", action: "update", subject: "Evaluation" },
  { role: "project_owner", action: "delete", subject: "Evaluation" },
  { role: "project_admin", action: "delete", subject: "Evaluation" },

  // --- EvaluationExtractionDataset -------------------------------------------
  { role: "project_owner", action: "list", subject: "EvaluationExtractionDataset" },
  { role: "project_admin", action: "list", subject: "EvaluationExtractionDataset" },
  { role: "project_owner", action: "create", subject: "EvaluationExtractionDataset" },
  { role: "project_admin", action: "create", subject: "EvaluationExtractionDataset" },
  { role: "project_owner", action: "update", subject: "EvaluationExtractionDataset" },
  { role: "project_admin", action: "update", subject: "EvaluationExtractionDataset" },
  { role: "project_owner", action: "delete", subject: "EvaluationExtractionDataset" },
  { role: "project_admin", action: "delete", subject: "EvaluationExtractionDataset" },

  // --- EvaluationExtractionRun -----------------------------------------------
  { role: "project_owner", action: "list", subject: "EvaluationExtractionRun" },
  { role: "project_admin", action: "list", subject: "EvaluationExtractionRun" },
  { role: "project_owner", action: "create", subject: "EvaluationExtractionRun" },
  { role: "project_admin", action: "create", subject: "EvaluationExtractionRun" },
  { role: "project_owner", action: "update", subject: "EvaluationExtractionRun" },
  { role: "project_admin", action: "update", subject: "EvaluationExtractionRun" },
  { role: "project_owner", action: "delete", subject: "EvaluationExtractionRun" },
  { role: "project_admin", action: "delete", subject: "EvaluationExtractionRun" },

  // --- EvaluationReport ------------------------------------------------------
  // Inherits ProjectScopedPolicy default — canList grants to any project member.
  { role: "project_owner", action: "list", subject: "EvaluationReport" },
  { role: "project_admin", action: "list", subject: "EvaluationReport" },
  { role: "project_member", action: "list", subject: "EvaluationReport" },
  { role: "project_owner", action: "create", subject: "EvaluationReport" },
  { role: "project_admin", action: "create", subject: "EvaluationReport" },
  { role: "project_owner", action: "update", subject: "EvaluationReport" },
  { role: "project_admin", action: "update", subject: "EvaluationReport" },
  { role: "project_owner", action: "delete", subject: "EvaluationReport" },
  { role: "project_admin", action: "delete", subject: "EvaluationReport" },

  // --- Invitation (target discriminator) -------------------------------------
  {
    role: "project_owner",
    action: "list",
    subject: "Invitation",
    conditions: { targetType: "project" },
  },
  {
    role: "project_admin",
    action: "list",
    subject: "Invitation",
    conditions: { targetType: "project" },
  },
  {
    role: "project_owner",
    action: "create",
    subject: "Invitation",
    conditions: { targetType: "project" },
  },
  {
    role: "project_admin",
    action: "create",
    subject: "Invitation",
    conditions: { targetType: "project" },
  },
  {
    role: "project_owner",
    action: "delete",
    subject: "Invitation",
    conditions: { targetType: "project" },
  },
  {
    role: "project_admin",
    action: "delete",
    subject: "Invitation",
    conditions: { targetType: "project" },
  },
  {
    role: "agent_owner",
    action: "list",
    subject: "Invitation",
    conditions: { targetType: "agent" },
  },
  {
    role: "agent_admin",
    action: "list",
    subject: "Invitation",
    conditions: { targetType: "agent" },
  },
  {
    role: "agent_owner",
    action: "create",
    subject: "Invitation",
    conditions: { targetType: "agent" },
  },
  {
    role: "agent_admin",
    action: "create",
    subject: "Invitation",
    conditions: { targetType: "agent" },
  },
  {
    role: "agent_owner",
    action: "delete",
    subject: "Invitation",
    conditions: { targetType: "agent" },
  },
  {
    role: "agent_admin",
    action: "delete",
    subject: "Invitation",
    conditions: { targetType: "agent" },
  },
  {
    role: "project_owner",
    action: "list",
    subject: "Invitation",
    conditions: { targetType: "review_campaign" },
  },
  {
    role: "project_admin",
    action: "list",
    subject: "Invitation",
    conditions: { targetType: "review_campaign" },
  },
  {
    role: "project_owner",
    action: "create",
    subject: "Invitation",
    conditions: { targetType: "review_campaign" },
  },
  {
    role: "project_admin",
    action: "create",
    subject: "Invitation",
    conditions: { targetType: "review_campaign" },
  },
  {
    role: "project_owner",
    action: "delete",
    subject: "Invitation",
    conditions: { targetType: "review_campaign" },
  },
  {
    role: "project_admin",
    action: "delete",
    subject: "Invitation",
    conditions: { targetType: "review_campaign" },
  },

  // --- ProjectMembership -----------------------------------------------------
  { role: "project_owner", action: "list", subject: "ProjectMembership" },
  { role: "project_admin", action: "list", subject: "ProjectMembership" },
  { role: "project_owner", action: "create", subject: "ProjectMembership" },
  { role: "project_admin", action: "create", subject: "ProjectMembership" },
  { role: "project_owner", action: "update", subject: "ProjectMembership" },
  { role: "project_admin", action: "update", subject: "ProjectMembership" },
  { role: "project_owner", action: "delete", subject: "ProjectMembership" },
  { role: "project_admin", action: "delete", subject: "ProjectMembership" },

  // --- AgentMembership -------------------------------------------------------
  // FIXME in source code: should gate on agent_admin/owner, not project_admin/owner.
  // Catalog encodes CURRENT behaviour (project role). Bug fix is a separate PR.
  {
    role: "project_owner",
    action: "list",
    subject: "AgentMembership",
    reason: "AgentMembershipPolicy FIXME — gates on project role today; should be agent role.",
  },
  { role: "project_admin", action: "list", subject: "AgentMembership" },
  { role: "project_owner", action: "create", subject: "AgentMembership" },
  { role: "project_admin", action: "create", subject: "AgentMembership" },
  { role: "project_owner", action: "update", subject: "AgentMembership" },
  { role: "project_admin", action: "update", subject: "AgentMembership" },
  { role: "project_owner", action: "delete", subject: "AgentMembership" },
  { role: "project_admin", action: "delete", subject: "AgentMembership" },

  // --- ReviewCampaignMembership ----------------------------------------------
  // Catalog-only subject (no policy class). Mirrors `ReviewCampaign.update`.
  // The single live endpoint (`revokeMembership`) stays gated by `ReviewCampaignPolicy.canUpdate` for now.
  { role: "project_owner", action: "list", subject: "ReviewCampaignMembership" },
  { role: "project_admin", action: "list", subject: "ReviewCampaignMembership" },
  { role: "project_owner", action: "create", subject: "ReviewCampaignMembership" },
  { role: "project_admin", action: "create", subject: "ReviewCampaignMembership" },
  { role: "project_owner", action: "update", subject: "ReviewCampaignMembership" },
  { role: "project_admin", action: "update", subject: "ReviewCampaignMembership" },
  { role: "project_owner", action: "delete", subject: "ReviewCampaignMembership" },
  { role: "project_admin", action: "delete", subject: "ReviewCampaignMembership" },

  // --- ReviewCampaign --------------------------------------------------------
  { role: "project_owner", action: "list", subject: "ReviewCampaign" },
  { role: "project_admin", action: "list", subject: "ReviewCampaign" },
  { role: "project_owner", action: "create", subject: "ReviewCampaign" },
  { role: "project_admin", action: "create", subject: "ReviewCampaign" },
  { role: "project_owner", action: "read", subject: "ReviewCampaign" },
  { role: "project_admin", action: "read", subject: "ReviewCampaign" },
  { role: "project_owner", action: "update", subject: "ReviewCampaign" },
  { role: "project_admin", action: "update", subject: "ReviewCampaign" },
  { role: "project_owner", action: "delete", subject: "ReviewCampaign" },
  { role: "project_admin", action: "delete", subject: "ReviewCampaign" },

  // --- BaseAgentSession (type discriminator) ---------------------------------
  // live: any project member; playground: admin/owner only.
  {
    role: "project_owner",
    action: "list",
    subject: "BaseAgentSession",
    conditions: { type: "live" },
  },
  {
    role: "project_admin",
    action: "list",
    subject: "BaseAgentSession",
    conditions: { type: "live" },
  },
  {
    role: "project_member",
    action: "list",
    subject: "BaseAgentSession",
    conditions: { type: "live" },
  },
  {
    role: "project_owner",
    action: "list",
    subject: "BaseAgentSession",
    conditions: { type: "playground" },
  },
  {
    role: "project_admin",
    action: "list",
    subject: "BaseAgentSession",
    conditions: { type: "playground" },
  },
  {
    role: "project_owner",
    action: "create",
    subject: "BaseAgentSession",
    conditions: { type: "live" },
  },
  {
    role: "project_admin",
    action: "create",
    subject: "BaseAgentSession",
    conditions: { type: "live" },
  },
  {
    role: "project_member",
    action: "create",
    subject: "BaseAgentSession",
    conditions: { type: "live" },
  },
  {
    role: "project_owner",
    action: "create",
    subject: "BaseAgentSession",
    conditions: { type: "playground" },
  },
  {
    role: "project_admin",
    action: "create",
    subject: "BaseAgentSession",
    conditions: { type: "playground" },
  },
  {
    role: "project_owner",
    action: "delete",
    subject: "BaseAgentSession",
    conditions: { type: "live" },
  },
  {
    role: "project_admin",
    action: "delete",
    subject: "BaseAgentSession",
    conditions: { type: "live" },
  },
  {
    role: "project_member",
    action: "delete",
    subject: "BaseAgentSession",
    conditions: { type: "live" },
  },
  {
    role: "project_owner",
    action: "delete",
    subject: "BaseAgentSession",
    conditions: { type: "playground" },
  },
  {
    role: "project_admin",
    action: "delete",
    subject: "BaseAgentSession",
    conditions: { type: "playground" },
  },

  // --- CampaignReport --------------------------------------------------------
  // Dual-role OR: admin path (project owner/admin, no status gate) + reviewer path (reviewer, status ≠ draft).
  { role: "project_owner", action: "read", subject: "CampaignReport" },
  { role: "project_admin", action: "read", subject: "CampaignReport" },
  {
    role: "campaign_reviewer",
    action: "read",
    subject: "CampaignReport",
    conditions: { status: { $ne: "draft" } },
  },

  // --- Reviewer --------------------------------------------------------------
  // list/read: status ≠ draft. create/update/review: status = active.
  {
    role: "campaign_reviewer",
    action: "list",
    subject: "Reviewer",
    conditions: { status: { $ne: "draft" } },
  },
  {
    role: "campaign_reviewer",
    action: "read",
    subject: "Reviewer",
    conditions: { status: { $ne: "draft" } },
  },
  {
    role: "campaign_reviewer",
    action: "create",
    subject: "Reviewer",
    conditions: { status: "active" },
  },
  {
    role: "campaign_reviewer",
    action: "update",
    subject: "Reviewer",
    conditions: { status: "active" },
  },
  {
    role: "campaign_reviewer",
    action: "review",
    subject: "Reviewer",
    conditions: { status: "active" },
  },

  // --- Tester ---------------------------------------------------------------
  // All tester actions require status = active. viewSharedContext also opens to reviewers (status ≠ draft).
  { role: "campaign_tester", action: "list", subject: "Tester", conditions: { status: "active" } },
  { role: "campaign_tester", action: "read", subject: "Tester", conditions: { status: "active" } },
  {
    role: "campaign_tester",
    action: "create",
    subject: "Tester",
    conditions: { status: "active" },
  },
  {
    role: "campaign_tester",
    action: "update",
    subject: "Tester",
    conditions: { status: "active" },
  },
  {
    role: "campaign_tester",
    action: "actAsTester",
    subject: "Tester",
    conditions: { status: "active" },
  },
  {
    role: "campaign_tester",
    action: "viewSharedContext",
    subject: "Tester",
    conditions: { status: "active" },
    reason: "Tester path of dual-role viewSharedContext rule.",
  },
  {
    role: "campaign_reviewer",
    action: "viewSharedContext",
    subject: "Tester",
    conditions: { status: { $ne: "draft" } },
    reason: "Reviewer path of dual-role viewSharedContext rule.",
  },

  // --- AgentsAnalytics -------------------------------------------------------
  // Requires agent role (project role is NOT sufficient — differs from AgentPolicy.canList).
  { role: "agent_owner", action: "list", subject: "AgentsAnalytics" },
  { role: "agent_admin", action: "list", subject: "AgentsAnalytics" },

  // --- ProjectsAnalytics -----------------------------------------------------
  // Project owner/admin only (member excluded). Cross-org bug present in source — preserved as-is.
  { role: "project_owner", action: "list", subject: "ProjectsAnalytics" },
  { role: "project_admin", action: "list", subject: "ProjectsAnalytics" },
]

/**
 * Idempotent SQL-based seed. Used by both the seed migration and
 * `setupE2eTestDatabase`. Batches inserts into a single statement per table
 * to keep the per-call overhead under a few hundred ms — naive per-row
 * inserts trip the default Jest hook timeout in 6-worker parallel test runs.
 *
 * Fast-path: if the catalog is already fully seeded (`role_permission` row
 * count matches `RBAC_CATALOG.length`), skip the bulk-insert work entirely.
 * This matters under tests where every `setupE2eTestDatabase` call reruns
 * the seed; without the skip the `NOT EXISTS`-checked CTE is run N×.
 */
export async function seedRbacCatalog(queryRunner: QueryRunner): Promise<void> {
  const existingRows = (await queryRunner.query(
    `SELECT COUNT(*)::text AS count FROM "role_permission" WHERE "deleted_at" IS NULL`,
  )) as Array<{ count: string }>
  if (existingRows[0] && Number(existingRows[0].count) >= RBAC_CATALOG.length) return

  // 1. Bulk-insert distinct (action, subject) pairs into permission.
  const permissionPairs = Array.from(
    new Map(RBAC_CATALOG.map((rule) => [`${rule.action}:${rule.subject}`, rule])).values(),
  )
  const permissionValues: string[] = []
  const permissionParams: unknown[] = []
  permissionPairs.forEach((rule, index) => {
    const offset = index * 2
    permissionValues.push(`($${offset + 1}, $${offset + 2})`)
    permissionParams.push(rule.action, rule.subject)
  })
  if (permissionValues.length > 0) {
    await queryRunner.query(
      `INSERT INTO "permission" ("action", "subject") VALUES ${permissionValues.join(", ")}
       ON CONFLICT ("action", "subject") DO NOTHING`,
      permissionParams,
    )
  }

  // 2. Bulk-insert role_permission rows. We rely on the
  //    `(role_id, permission_id, COALESCE(conditions, '{}'))` containment
  //    check via the `NOT EXISTS` subquery in the source CTE — Postgres has
  //    no partial-unique index that matches JSONB equivalence directly.
  const ruleValues: string[] = []
  const ruleParams: unknown[] = []
  RBAC_CATALOG.forEach((rule, index) => {
    const offset = index * 6
    ruleValues.push(
      `($${offset + 1}, $${offset + 2}, $${offset + 3}::jsonb, $${offset + 4}::text[], $${offset + 5}::bool, $${offset + 6})`,
    )
    ruleParams.push(
      rule.role,
      rule.action,
      rule.conditions ? JSON.stringify(rule.conditions) : null,
      rule.fields ?? null,
      rule.inverted ?? false,
      rule.subject,
    )
  })
  if (ruleValues.length === 0) return

  await queryRunner.query(
    `WITH catalog (role_name, action, conditions, fields, inverted, subject) AS (
       VALUES ${ruleValues.join(", ")}
     )
     INSERT INTO "role_permission" ("role_id", "permission_id", "conditions", "fields", "inverted", "reason")
     SELECT r.id, p.id, c.conditions, c.fields, c.inverted, NULL
     FROM catalog c
     INNER JOIN "role" r ON r.name = c.role_name
     INNER JOIN "permission" p ON p.action = c.action AND p.subject = c.subject
     WHERE NOT EXISTS (
       SELECT 1 FROM "role_permission" rp
       WHERE rp.role_id = r.id
         AND rp.permission_id = p.id
         AND rp.deleted_at IS NULL
         AND COALESCE(rp.conditions, '{}'::jsonb) = COALESCE(c.conditions, '{}'::jsonb)
     )`,
    ruleParams,
  )
}

/** Counterpart for migration `down()` / test cleanup. Removes every rule in the catalog. */
export async function truncateRbacCatalog(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`DELETE FROM "role_permission"`)
  await queryRunner.query(`DELETE FROM "permission"`)
}
