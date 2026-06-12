import { AbilityBuilder, createMongoAbility, type MongoAbility } from "@casl/ability"
import { Injectable } from "@nestjs/common"
import type { AgentGrant, CampaignGrant, OrganizationGrant, ProjectGrant } from "./grants"
import type { RbacRoleName } from "./rbac.constants"
import type { UserGrant } from "./rbac.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { RbacService } from "./rbac.service"
import type { AppAction, AppSubject, CatalogRule } from "./rbac-catalog"
import { RBAC_CATALOG } from "./rbac-catalog"

export type RequestGrants = {
  organizationMembership?: OrganizationGrant
  projectMembership?: ProjectGrant
  agentMembership?: AgentGrant
  testerMembership?: CampaignGrant
  reviewerMembership?: CampaignGrant
}

/**
 * Convert the per-request loaded memberships (attached by context resolvers)
 * into the `UserGrant[]` shape the catalog projector consumes. This skips the
 * DB hit of `loadUserGrants` since the resolvers already loaded the grants
 * relevant to this URL's scope.
 */
function requestGrantsToUserGrants(loaded: RequestGrants): UserGrant[] {
  const grants: UserGrant[] = []
  if (loaded.organizationMembership) {
    grants.push({
      roleName: `org_${loaded.organizationMembership.role}` as RbacRoleName,
      conditions: { organizationId: loaded.organizationMembership.organizationId },
    })
  }
  if (loaded.projectMembership) {
    grants.push({
      roleName: `project_${loaded.projectMembership.role}` as RbacRoleName,
      conditions: {
        organizationId: loaded.projectMembership.organizationId,
        projectId: loaded.projectMembership.projectId,
      },
    })
  }
  if (loaded.agentMembership) {
    grants.push({
      roleName: `agent_${loaded.agentMembership.role}` as RbacRoleName,
      conditions: {
        organizationId: loaded.agentMembership.organizationId,
        projectId: loaded.agentMembership.projectId,
        agentId: loaded.agentMembership.agentId,
      },
    })
  }
  if (loaded.testerMembership) {
    grants.push({
      roleName: "campaign_tester",
      conditions: {
        organizationId: loaded.testerMembership.organizationId,
        projectId: loaded.testerMembership.projectId,
        campaignId: loaded.testerMembership.campaignId,
      },
    })
  }
  if (loaded.reviewerMembership) {
    grants.push({
      roleName: "campaign_reviewer",
      conditions: {
        organizationId: loaded.reviewerMembership.organizationId,
        projectId: loaded.reviewerMembership.projectId,
        campaignId: loaded.reviewerMembership.campaignId,
      },
    })
  }
  return grants
}

/**
 * The CASL ability type for this application. Subjects are string-tagged
 * (`subject("Project", instance)`) — no class-based subjects.
 *
 * `"all"` is CASL's universal-subject literal used for the wildcard fallback
 * (root-level deny). The factory builds its rules entirely from the
 * `permission` / `role_permission` catalog plus the env-driven
 * `Organization.create` rule.
 */
export type AppAbility = MongoAbility<[AppAction, AppSubject | "all"]>

/**
 * Per-subject scope-key → entity-field translator. For each subject, we map
 * a `user_role.conditions` key (e.g. `projectId`) to the entity field name
 * the CASL rule's condition should check (e.g. `id` for Project, `projectId`
 * for Document). Unlisted keys default to identity. A value of `null` means
 * "drop this scope key for this subject" — used when the policy never
 * compares the scope key against the entity.
 */
const SCOPE_KEY_TO_ENTITY_FIELD: Partial<Record<AppSubject, Record<string, string | null>>> = {
  Project: { projectId: "id" },
  Agent: { agentId: "id" },
  Organization: { organizationId: "id" },
  ReviewCampaign: {}, // Default identity — entity carries projectId/organizationId.
  // Synthetic campaign subjects: rules check the campaign's `id` + `status` only.
  // ReviewerPolicy / TesterPolicy never compare org/project against the entity.
  Reviewer: { campaignId: "id", organizationId: null, projectId: null },
  Tester: { campaignId: "id", organizationId: null, projectId: null },
  AgentsAnalytics: { agentId: "id" }, // Synthetic; instance = Agent.
  // Synthetic; instance = Project. NOTE: source bug — `organizationId` is NOT
  // checked against the entity here. Dropped to preserve current behaviour.
  ProjectsAnalytics: { projectId: "id", organizationId: null },
}

/**
 * Translate a `user_role.conditions` payload into the CASL rule's `conditions`
 * (entity-field namespace) for a given subject. Keys mapped to `null` are
 * dropped (e.g. `Reviewer.organizationId` — the policy never checks it).
 */
function translateScopeConditions(
  subject: AppSubject,
  scope: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!scope) return {}
  const subjectOverrides = SCOPE_KEY_TO_ENTITY_FIELD[subject] ?? {}
  const out: Record<string, unknown> = {}
  for (const [scopeKey, value] of Object.entries(scope)) {
    const mapped = subjectOverrides[scopeKey]
    if (mapped === null) continue
    out[mapped ?? scopeKey] = value
  }
  return out
}

type CatalogRow = {
  role_name: RbacRoleName
  action: AppAction
  subject: AppSubject
  conditions: Record<string, unknown> | null
  fields: string[] | null
  inverted: boolean
}

/**
 * Pure rule-builder shared by the DB-backed `AbilityFactory.forUser` (prod
 * path) and policy specs (synchronous, no DB). Given a user's grants and a
 * catalog, projects every (grant × matching catalog row) into a CASL rule
 * by merging the per-grant scope conditions with the per-row rule-level
 * conditions. `Organization.create` is layered on top when the env-domain
 * gate matches.
 */
export function buildAbilityFromCatalog(params: {
  grants: UserGrant[]
  catalog: CatalogRow[] | readonly CatalogRule[]
  email: string | null
}): AppAbility {
  const { grants, catalog, email } = params
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility)

  // Catalog rows from DB are keyed by `role_name`; the in-memory TS constant
  // is keyed by `role`. Normalize to a single shape locally.
  const rows = catalog.map((entry) =>
    "role_name" in entry
      ? entry
      : ({
          role_name: entry.role,
          action: entry.action,
          subject: entry.subject,
          conditions: entry.conditions ?? null,
          fields: entry.fields ?? null,
          inverted: entry.inverted ?? false,
        } satisfies CatalogRow),
  )

  for (const grant of grants) {
    const matching = rows.filter((row) => row.role_name === grant.roleName)
    for (const row of matching) {
      const scopeConditions = translateScopeConditions(row.subject, grant.conditions)
      const ruleConditions = (row.conditions ?? {}) as Record<string, unknown>
      const mergedConditions = { ...scopeConditions, ...ruleConditions }
      const fields = row.fields ?? undefined
      const conditions = Object.keys(mergedConditions).length > 0 ? mergedConditions : undefined
      const verb = row.inverted ? builder.cannot : builder.can
      if (fields) {
        verb.call(builder, row.action, row.subject, fields, conditions)
      } else {
        verb.call(builder, row.action, row.subject, conditions)
      }
    }
  }

  if (canCreateOrganizationByEmailDomain(email)) {
    builder.can("create", "Organization")
  }

  return builder.build()
}

/** Synchronous test/spec helper: build an Ability from grants using the in-memory `RBAC_CATALOG`. */
export function buildAbilityFromGrants(params: {
  grants: UserGrant[]
  email?: string | null
}): AppAbility {
  return buildAbilityFromCatalog({
    grants: params.grants,
    catalog: RBAC_CATALOG,
    email: params.email ?? null,
  })
}

/**
 * `process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN` is the legacy gate for
 * who may self-serve an organization. RBAC doesn't model this, so the
 * factory injects the ability at build time when the user's email matches.
 * Mirrors the legacy `OrganizationPolicy.canCreate` semantics verbatim —
 * the env var is suffix-matched as-is (callers may supply it with or
 * without a leading `@`).
 */
function canCreateOrganizationByEmailDomain(email: string | null): boolean {
  const allowedDomain = process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN?.trim().toLowerCase()
  if (!allowedDomain || !email) return false
  return email.trim().toLowerCase().endsWith(allowedDomain)
}

/**
 * Builds an `AppAbility` for a given user by querying their `user_role`
 * grants and projecting them through the in-memory `RBAC_CATALOG`. Single
 * DB query per request (`loadUserGrants`); the catalog itself is a TS
 * constant kept in sync with the `seed-rbac-permission-catalog` migration.
 *
 * Why in-memory: under 6-worker parallel test load (and equally under
 * production traffic), every authenticated request goes through this
 * factory via `CaslAbilityGuard`. A second `role_permission ⋈ role ⋈
 * permission` join per request saturates the Postgres pool. The catalog
 * doesn't change at runtime — any catalog change ships a new migration AND
 * a new `RBAC_CATALOG` version atomically.
 */
@Injectable()
export class AbilityFactory {
  constructor(private readonly rbacService: RbacService) {}

  /**
   * Fast path used by `CaslAbilityGuard`: builds the ability from grants
   * that the context resolvers have already loaded onto the request. No DB
   * query. Other grants the user might hold (outside this request's URL
   * scope) are intentionally excluded — they can't authorize this request
   * anyway.
   */
  forRequest(user: { email: string | null }, loaded: RequestGrants): AppAbility {
    return buildAbilityFromCatalog({
      grants: requestGrantsToUserGrants(loaded),
      catalog: RBAC_CATALOG,
      email: user.email,
    })
  }

  /**
   * DB-backed path: loads ALL grants for a user, regardless of request scope.
   * Used by tests + non-request callers. Production guards should prefer
   * `forRequest` to avoid an extra `user_role` round trip per request.
   */
  async forUser(user: { id: string; email: string | null }): Promise<AppAbility> {
    const grants = await this.rbacService.loadUserGrants(user.id)
    return buildAbilityFromCatalog({ grants, catalog: RBAC_CATALOG, email: user.email })
  }
}
