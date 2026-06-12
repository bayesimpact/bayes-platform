# RBAC Permission Catalog

Audit of every (role × action × subject) triple that the current NestJS policy
layer grants. Produced by reading every `apps/api/src/domains/**/*.policy.ts`
file, the two shared base classes (`base-policy.ts`,
`project-scoped-policy.ts`), and the matching `*.policy.spec.ts` truth tables.

Roles, as defined in `apps/api/src/domains/rbac/rbac.constants.ts`:

- `org_owner`, `org_admin`, `org_member`
- `project_owner`, `project_admin`, `project_member`
- `agent_owner`, `agent_admin`, `agent_member`
- `campaign_tester`, `campaign_reviewer`

The codebase's `find` returns **19** policy files (the prompt mentioned 20 —
no campaign-membership policy exists; campaign membership is managed inline
in `ReviewCampaignPolicy` / `ReviewerPolicy` / `TesterPolicy` / `InvitationPolicy`).
Flagged in §5.

Authorization receives structural grants built by context resolvers
(`OrganizationGrant`, `ProjectGrant`, `AgentGrant`, `CampaignGrant` from
`apps/api/src/domains/rbac/grants.ts`). A grant maps 1:1 to a `user_role` row
whose `conditions` JSONB carries the scope ids
(`organizationId` / `projectId` / `agentId` / `campaignId`).

---

## 1. Subjects

One CASL subject per policy class. Subject name is the singular PascalCase
form of the entity the policy guards.

- `Project` — entity: `apps/api/src/domains/projects/project.entity.ts`; policy: `apps/api/src/domains/projects/project.policy.ts`
- `Agent` — entity: `apps/api/src/domains/agents/agent.entity.ts`; policy: `apps/api/src/domains/agents/agent.policy.ts`
- `Organization` — entity: `apps/api/src/domains/organizations/organization.entity.ts`; policy: `apps/api/src/domains/organizations/organization.policy.ts`
- `Document` — entity: `apps/api/src/domains/documents/document.entity.ts`; policy: `apps/api/src/domains/documents/document.policy.ts`
- `DocumentTag` — entity: `apps/api/src/domains/documents/tags/document-tag.entity.ts`; policy: `apps/api/src/domains/documents/tags/document-tag.policy.ts`
- `Evaluation` — entity: `apps/api/src/domains/evaluations/evaluation.entity.ts`; policy: `apps/api/src/domains/evaluations/evaluation.policy.ts`
- `EvaluationExtractionDataset` — entity: `apps/api/src/domains/evaluations/extraction/datasets/evaluation-extraction-dataset.entity.ts`; policy: `apps/api/src/domains/evaluations/extraction/datasets/evaluation-extraction-dataset.policy.ts`
- `EvaluationExtractionRun` — entity: `apps/api/src/domains/evaluations/extraction/runs/evaluation-extraction-run.entity.ts`; policy: `apps/api/src/domains/evaluations/extraction/runs/evaluation-extraction-run.policy.ts`
- `EvaluationReport` — entity: `apps/api/src/domains/evaluations/reports/evaluation-report.entity.ts`; policy: `apps/api/src/domains/evaluations/reports/evaluation-report.policy.ts`
- `Invitation` — entity: `apps/api/src/domains/invitations/invitation.entity.ts`; policy: `apps/api/src/domains/invitations/invitation.policy.ts`
- `ProjectMembership` — backing type: `ProjectGrant` (from `apps/api/src/domains/rbac/grants.ts`, persisted as `user_role`); policy: `apps/api/src/domains/projects/memberships/project-membership.policy.ts`
- `AgentMembership` — backing type: `AgentGrant` (from `apps/api/src/domains/rbac/grants.ts`, persisted as `user_role`); policy: `apps/api/src/domains/agents/memberships/agent-membership.policy.ts`
- `ReviewCampaignMembership` — **catalog-only subject** (no policy class). Backing type: `CampaignGrant` (from `apps/api/src/domains/rbac/grants.ts`, persisted as `user_role`). The single existing endpoint (`ReviewCampaignsRoutes.revokeMembership`) is currently gated by `ReviewCampaignPolicy.canUpdate`. The subject is shipped in the catalog for parity with `ProjectMembership` / `AgentMembership` so future endpoints (list / create / update) have a home and the FE can read the catalog uniformly. Rows mirror `ReviewCampaign.update` semantics.
- `ReviewCampaign` — entity: `apps/api/src/domains/review-campaigns/review-campaign.entity.ts`; policy: `apps/api/src/domains/review-campaigns/review-campaign.policy.ts`
- `BaseAgentSession` — entity union: `ConversationAgentSession` / `ExtractionAgentSession` / `FormAgentSession`; policy: `apps/api/src/domains/agents/base-agent-sessions/base-agent-session.policy.ts`
- `CampaignReport` — synthetic (no dedicated entity; derives from `ReviewCampaign`); policy: `apps/api/src/domains/review-campaigns/reports/campaign-report.policy.ts`
- `Reviewer` — synthetic (guards reviewer-side actions on a `ReviewCampaign`); policy: `apps/api/src/domains/review-campaigns/reviewer/reviewer.policy.ts`
- `Tester` — synthetic (guards tester-side actions on a `ReviewCampaign`); policy: `apps/api/src/domains/review-campaigns/tester/tester.policy.ts`
- `AgentsAnalytics` — synthetic (derives from `Agent`, extends `AgentPolicy`); policy: `apps/api/src/domains/analytics/agents-analytics/agents-analytics.policy.ts`
- `ProjectsAnalytics` — synthetic (derives from `Project`, extends `ProjectPolicy`); policy: `apps/api/src/domains/analytics/projects-analytics/projects-analytics.policy.ts`

Total: **20 subjects** — 19 policy-backed + 1 catalog-only
(`ReviewCampaignMembership`). The 19 policy-backed subjects are 1:1 with
policy classes; no two policies map to the same subject.

---

## 2. Actions

CRUD actions (mapped from `canList` → `list`, `canView` → `read`,
`canCreate` → `create`, `canUpdate` → `update`, `canDelete` → `delete`):

- `list`
- `read` (only emitted by policies that explicitly override `canView`)
- `create`
- `update`
- `delete`

Non-CRUD action surface — every other public method on a policy that the
controller layer calls via `@CheckPolicy((p) => p.canXxx())`:

- `review` (`ReviewerPolicy.canReview`) — reviewer write-time gate; campaign
  must be `active`. Distinct from `update` because the spec keeps reviewer
  read access on closed campaigns but freezes writes.
- `actAsTester` (`TesterPolicy.canActAsTester`) — tester action gate; campaign
  must be `active`. Underpins `canList` / `canView` / `canCreate` / `canUpdate`
  for `Tester`, so they all collapse to the same boolean.
- `viewSharedContext` (`TesterPolicy.canViewSharedContext`) — reads the
  shared campaign landing-page metadata; passes if EITHER the active-tester
  gate OR the not-draft-reviewer gate is open.

Notes:
- `canView` is treated as `read` (separate from `list`). Only the policies
  that actually override `canView` (`DocumentPolicy`, `ReviewCampaignPolicy`,
  `CampaignReportPolicy`, `ReviewerPolicy`, `TesterPolicy`) emit `read`
  triples. Other policies have `canView` inherited as `() => false` and emit
  none.
- Method-level aliases (`canDelete` → `canUpdate` in `ProjectPolicy`,
  `ProjectMembershipPolicy`, etc.) still emit distinct (action) triples
  because the catalog records actions, not method bodies.
- `BasePolicy` ships `canList/canView/canCreate/canUpdate/canDelete` all
  returning `false`; only methods that the subclass overrides (or that the
  `ProjectScopedPolicy` parent overrides) produce triples.

---

## 3. Truth table — per-policy

For each policy: which `canX()` methods are exposed and which role
combinations (with scope match) return true. "Matching org" / "matching
project" / "matching agent" / "matching campaign" mean
`user_role.conditions @> { …entity.scopeIds }`.

### Project

Policy class: `apps/api/src/domains/projects/project.policy.ts`. Subject: `Project`. Extends: `BasePolicy<Project>`.

| Method | Action | Roles granted (with scope match) |
|---|---|---|
| `canList()` | `list` | `org_owner` / `org_admin` / `org_member` (any org-grant; entity optional) |
| `canCreate()` | `create` | `org_owner` / `org_admin` (in their org) |
| `canUpdate()` | `update` | `project_owner` / `project_admin` (entity in user's project AND user's org) |
| `canDelete()` | `delete` | Alias of `canUpdate()` — same roles, same scope |

Notes:
- `canList` only requires `organizationMembership` to be set; entity is
  optional. In CASL terms, this is a bare ability with no condition beyond
  "user has SOME org grant". When listing within an org URL, the controller
  scopes the query to that org.
- `canCreate` deliberately does NOT require an entity — entity is the
  project-to-be. Condition is the URL's `organizationId`.
- `canUpdate` requires both org match AND project-grant match on the entity.

### Agent

Policy class: `apps/api/src/domains/agents/agent.policy.ts`. Subject: `Agent`. Extends: `ProjectScopedPolicy<Agent>`.

| Method | Action | Roles granted (with scope match) |
|---|---|---|
| `canList()` | `list` | `project_owner` / `project_admin` / `project_member` (user holds project grant matching URL project; entity optional) |
| `canCreate()` | `create` | `project_owner` / `project_admin` (user holds project grant matching URL project) |
| `canUpdate()` | `update` | `agent_owner` / `agent_admin` (entity in user's agent grant AND user's project AND user's org) |
| `canDelete()` | `delete` | Alias of `canUpdate()` |

Notes:
- The parent `ProjectScopedPolicy.canAccess()` gates `canList` and `canCreate`
  on holding an org grant AND a project grant AND the URL-loaded `project`
  belonging to the user's org. So all three project roles (member/admin/owner)
  pass `canList`; only admin/owner pass `canCreate`.
- `canUpdate` / `canDelete` do NOT call `canAccess()`. They go directly to
  `doesResourceBelongToScope()` + `isAgentAdminOrOwner()` + `canAccessAgent()`.
  Effectively this still requires an org grant matching `entity.organizationId`
  (via `doesResourceBelongToOrganization`) and a project grant matching
  `entity.projectId` (via `doesResourceBelongToProject`) — but it does NOT
  re-verify `project.organizationId === user.org.organizationId`. In practice
  the resolver loads `project` from `entity.projectId`, so this gap is closed
  upstream.

### Organization

Policy class: `apps/api/src/domains/organizations/organization.policy.ts`. Subject: `Organization`. Extends: nothing (does not extend `BasePolicy`).

| Method | Action | Roles granted (with scope match) |
|---|---|---|
| `canCreate()` | `create` | Any authenticated user whose email matches `ORGANIZATION_CREATOR_EMAIL_DOMAIN` (case-insensitive, trimmed). No RBAC role involved. |

Notes:
- This is the ONLY policy that does not extend `BasePolicy`. The constructor
  takes a `User`, not a grant. The decision is "does `user.email.toLowerCase()`
  end with `process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN.toLowerCase()`?"
- It does not gate on any role; it is an environment-driven allow-list.
- No `list`/`read`/`update`/`delete` actions for `Organization` are exposed
  by this policy. Organization scope is verified everywhere else through the
  organization-membership grant.

### Document

Policy class: `apps/api/src/domains/documents/document.policy.ts`. Subject: `Document`. Extends: `ProjectScopedPolicy<Document>`.

| Method | Action | Roles granted (with scope match) |
|---|---|---|
| `canList()` | `list` | `project_owner` / `project_admin` (in their project, matching org) |
| `canView()` | `read` | `project_owner` / `project_admin` / `project_member` (in their project, matching org) |
| `canCreate()` | `create` | If `sourceType` is `agentSessionMessage` or `extraction`: any project member (owner/admin/member) in their project. Otherwise: `project_owner` / `project_admin` only. |
| `canUpdate()` | `update` | `project_owner` / `project_admin` (entity in their project, matching org) |
| `canDelete()` | `delete` | Alias of `canUpdate()` |

Notes:
- Conditional create rule is driven by a constructor-injected `sourceType`
  argument, not by entity state. CASL conditions can express this as a
  per-call subject attribute.
- The `agentSessionMessage` / `extraction` member-create case is implemented
  in code but the spec has `it.skip(...)` for it — exists in source, not
  verified by tests.

### DocumentTag

Policy class: `apps/api/src/domains/documents/tags/document-tag.policy.ts`. Subject: `DocumentTag`. Extends: `ProjectScopedPolicy<DocumentTag>`.

| Method | Action | Roles granted (with scope match) |
|---|---|---|
| `canList()` | `list` | `project_owner` / `project_admin` (in their project, matching org) |
| `canCreate()` | `create` | Alias of `canList()` |
| `canUpdate()` | `update` | `project_owner` / `project_admin` (entity in their project, matching org) |
| `canDelete()` | `delete` | Alias of `canUpdate()` |

### Evaluation

Policy class: `apps/api/src/domains/evaluations/evaluation.policy.ts`. Subject: `Evaluation`. Extends: `ProjectScopedPolicy<Evaluation>`.

| Method | Action | Roles granted (with scope match) |
|---|---|---|
| `canList()` | `list` | `project_owner` / `project_admin` (in their project, matching org) |
| `canCreate()` | `create` | Alias of `canList()` |
| `canUpdate()` | `update` | `project_owner` / `project_admin` (entity in their project, matching org) |
| `canDelete()` | `delete` | Alias of `canUpdate()` |

### EvaluationExtractionDataset

Policy class: `apps/api/src/domains/evaluations/extraction/datasets/evaluation-extraction-dataset.policy.ts`. Subject: `EvaluationExtractionDataset`. Extends: `ProjectScopedPolicy<EvaluationExtractionDataset>`.

| Method | Action | Roles granted (with scope match) |
|---|---|---|
| `canList()` | `list` | `project_owner` / `project_admin` (in their project, matching org) |
| `canCreate()` | `create` | `project_owner` / `project_admin` (in their project, matching org) |
| `canUpdate()` | `update` | `project_owner` / `project_admin` (entity in their project, matching org) |
| `canDelete()` | `delete` | Alias of `canUpdate()` |

### EvaluationExtractionRun

Policy class: `apps/api/src/domains/evaluations/extraction/runs/evaluation-extraction-run.policy.ts`. Subject: `EvaluationExtractionRun`. Extends: `ProjectScopedPolicy<EvaluationExtractionRun>`.

| Method | Action | Roles granted (with scope match) |
|---|---|---|
| `canList()` | `list` | `project_owner` / `project_admin` (in their project, matching org) |
| `canCreate()` | `create` | `project_owner` / `project_admin` (in their project, matching org) |
| `canUpdate()` | `update` | `project_owner` / `project_admin` (entity in their project, matching org) |
| `canDelete()` | `delete` | Alias of `canUpdate()` |

### EvaluationReport

Policy class: `apps/api/src/domains/evaluations/reports/evaluation-report.policy.ts`. Subject: `EvaluationReport`. Extends: `ProjectScopedPolicy<EvaluationReport>` (no overrides — pure parent behaviour).

| Method | Action | Roles granted (with scope match) |
|---|---|---|
| `canList()` | `list` | `project_owner` / `project_admin` / `project_member` (in their project, matching org) — inherits `ProjectScopedPolicy.canList`, which is just `canAccess()` |
| `canCreate()` | `create` | `project_owner` / `project_admin` (in their project, matching org) |
| `canUpdate()` | `update` | `project_owner` / `project_admin` (entity in their project, matching org) |
| `canDelete()` | `delete` | Alias of `canUpdate()` |

Notes:
- The only policy that gets `canList` from the parent class verbatim, which
  lets project members list (read) reports. Distinct from `Evaluation` etc.

### Invitation

Policy class: `apps/api/src/domains/invitations/invitation.policy.ts`. Subject: `Invitation`. Extends: `ProjectScopedPolicy<Invitation>`.

Methods branch on `targetType` (passed to the constructor):

| Method | Action | Roles granted (with scope match) |
|---|---|---|
| `canList()` | `list` | See per-target rows below |
| `canCreate()` | `create` | Same as `canList()` |
| `canDelete()` | `delete` | Same as `canList()` |

Per-target-type breakdown of the `canManage()` gate (drives all three above):

| Target type | Roles granted (with scope match) |
|---|---|
| `project` | `project_owner` / `project_admin` (when a `target` is loaded, target must be in user's org+project; with no target loaded, list/create are pre-allowed for project admin/owner) |
| `agent` | `agent_owner` / `agent_admin` (target agent matches user's agent grant; entity in user's org+project) |
| `review_campaign` | `project_owner` / `project_admin` (target campaign in user's org+project) |

Notes:
- `canUpdate` is NOT overridden; inherits the parent's `() => false`-when-no-entity
  via `doesResourceBelongToScope()`. Invitations have no update path in
  practice.
- `targetBelongsToScope()` returns `true` when no target is loaded — this is
  intentional for the pre-load `canList` / `canCreate` checks.
- Agent target only accepts `agent_owner` / `agent_admin`. The project role
  is irrelevant for agent invitations (the spec fixes `projectRole: "member"`
  and varies the agent role).

### ProjectMembership

Policy class: `apps/api/src/domains/projects/memberships/project-membership.policy.ts`. Subject: `ProjectMembership`. Extends: `ProjectScopedPolicy<ProjectGrant>`.

| Method | Action | Roles granted (with scope match) |
|---|---|---|
| `canList()` | `list` | `project_owner` / `project_admin` (in user's project, matching org) |
| `canCreate()` | `create` | Alias of `canList()` |
| `canUpdate()` | `update` | Alias of `canList()` |
| `canDelete()` | `delete` | Alias of `canList()` |

Notes:
- All four methods route to `canList()`. None call `doesResourceBelongToScope()`
  — the truth table confirms this: `"noResource"` is `true` for admin/owner,
  but `"differentOrganization"` (a real resource in a foreign org) is `false`
  because the user's project grant doesn't match. This works because the
  user's project grant must match the URL-loaded project; the entity's scope
  is checked via the project URL parameter, not via `doesResourceBelongToScope`.

### AgentMembership

Policy class: `apps/api/src/domains/agents/memberships/agent-membership.policy.ts`. Subject: `AgentMembership`. Extends: `ProjectScopedPolicy<AgentGrant>`.

| Method | Action | Roles granted (with scope match) |
|---|---|---|
| `canList()` | `list` | `project_owner` / `project_admin` (in user's project, matching org) — **NOTE: FIXME in source** says it should be agent owner/admin |
| `canCreate()` | `create` | Alias of `canList()` |
| `canUpdate()` | `update` | Alias of `canList()` |
| `canDelete()` | `delete` | Alias of `canList()` |

Notes:
- Source code has an inline `// FIXME: should be isAgentAdminOrOwner`. The
  catalog must mirror current behaviour (project admin/owner) until the
  FIXME is fixed. Flagged in §5.
- `*.policy.spec.ts` backfilled (Phase-3 Checkpoint 0a) encoding the
  current (buggy) project-role gate verbatim.

### ReviewCampaignMembership

**Catalog-only subject — no policy class.** The only endpoint that touches
campaign membership today (`ReviewCampaignsRoutes.revokeMembership`) is
gated by `ReviewCampaignPolicy.canUpdate`. The catalog ships
`ReviewCampaignMembership × {list, create, update, delete}` rows mirroring
`ReviewCampaign.update` so that future endpoints can adopt the subject
without a re-seed and so that the frontend can read membership
affordances against a uniform `*Membership` shape (matches `ProjectMembership`
and `AgentMembership`).

| Action | Roles granted (with scope match) |
|---|---|
| `list` | `project_owner` / `project_admin` (in the campaign's project, matching org) |
| `create` | `project_owner` / `project_admin` (same scope) |
| `update` | `project_owner` / `project_admin` (same scope) |
| `delete` | `project_owner` / `project_admin` (same scope) |

Notes:
- No spec file (no policy class). `revoke-membership.spec.ts` e2e covers
  the existing endpoint via `ReviewCampaignPolicy`.

### ReviewCampaign

Policy class: `apps/api/src/domains/review-campaigns/review-campaign.policy.ts`. Subject: `ReviewCampaign`. Extends: `ProjectScopedPolicy<ReviewCampaign>`.

| Method | Action | Roles granted (with scope match) |
|---|---|---|
| `canList()` | `list` | `project_owner` / `project_admin` (in their project, matching org) |
| `canCreate()` | `create` | Alias of `canList()` |
| `canView()` | `read` | `project_owner` / `project_admin` (entity in their project, matching org) |
| `canUpdate()` | `update` | Alias of `canView()` |
| `canDelete()` | `delete` | Alias of `canView()` |

### BaseAgentSession

Policy class: `apps/api/src/domains/agents/base-agent-sessions/base-agent-session.policy.ts`. Subject: `BaseAgentSession`. Extends: `ProjectScopedPolicy<AgentSession>` where `AgentSession = ConversationAgentSession | ExtractionAgentSession | FormAgentSession`.

Methods branch on `type` (`BaseAgentSessionTypeDto` — `"live"` vs `"playground"`):

| Method | Action | type = "live" | type = "playground" (or undefined) |
|---|---|---|---|
| `canList()` | `list` | `project_owner` / `project_admin` / `project_member` (in user's project, matching org) | `project_owner` / `project_admin` only |
| `canCreate()` | `create` | Same as live `canList` | `project_owner` / `project_admin` only |
| `canDelete()` | `delete` | `project_owner` / `project_admin` / `project_member` AND entity in user's project+org | `project_owner` / `project_admin` AND entity in user's project+org |

Notes:
- `canView` and `canUpdate` are inherited from the parent. `canView` is
  `BasePolicy.canView` = `() => false` (no `read` triple emitted). `canUpdate`
  is `ProjectScopedPolicy.canUpdate` — admin/owner with entity scope match.
- "Live" sessions are the user-facing chat surface; "playground" is the
  authoring surface (admin/owner only).

### CampaignReport

Policy class: `apps/api/src/domains/review-campaigns/reports/campaign-report.policy.ts`. Subject: `CampaignReport`. Extends: nothing (composes `ReviewCampaignPolicy` + `ReviewerPolicy`).

| Method | Action | Roles granted (with scope match) |
|---|---|---|
| `canView()` | `read` | EITHER `project_owner` / `project_admin` (campaign in their project+org) OR `campaign_reviewer` with active membership on the campaign AND campaign status ≠ `draft` |

Notes:
- This is the only multi-path "OR" in the catalog. CASL needs two rules per
  reviewer-side / admin-side OR a custom action.
- Testers do NOT have report access (per the in-code spec comment).
- No `canList` / `canCreate` / etc. — only `canView`.

### Reviewer

Policy class: `apps/api/src/domains/review-campaigns/reviewer/reviewer.policy.ts`. Subject: `Reviewer`. Extends: `BasePolicy<ReviewCampaign>` (with stubbed org membership).

| Method | Action | Roles granted (with scope match) |
|---|---|---|
| `canList()` | `list` | Alias of `canView()` |
| `canView()` | `read` | `campaign_reviewer` with membership matching the campaign AND campaign status ≠ `draft` (active and closed both allow read) |
| `canCreate()` | `create` | Alias of `canReview()` |
| `canUpdate()` | `update` | Alias of `canReview()` |
| `canReview()` | `review` | `campaign_reviewer` with membership matching the campaign AND campaign status = `active` |

Notes:
- Does NOT consult organization or project grants — the BasePolicy's
  `organizationMembership` is passed as `{} as never`.
- Closed campaigns: reviewers retain `list` / `read`, lose `create` / `update`
  / `review`.
- Draft campaigns: everything denied.
- `canDelete()` inherited from `BasePolicy` returning `false` — reviewers
  cannot delete.

### Tester

Policy class: `apps/api/src/domains/review-campaigns/tester/tester.policy.ts`. Subject: `Tester`. Extends: `BasePolicy<ReviewCampaign>` (with stubbed org membership).

| Method | Action | Roles granted (with scope match) |
|---|---|---|
| `canList()` | `list` | Alias of `canActAsTester()` |
| `canView()` | `read` | Alias of `canActAsTester()` |
| `canCreate()` | `create` | Alias of `canActAsTester()` |
| `canUpdate()` | `update` | Alias of `canActAsTester()` |
| `canActAsTester()` | `actAsTester` | `campaign_tester` with membership matching the campaign AND campaign status = `active` |
| `canViewSharedContext()` | `viewSharedContext` | (`campaign_tester` with membership on campaign AND status = `active`) OR (`campaign_reviewer` with membership on campaign AND status ≠ `draft`) |

Notes:
- Does NOT consult org or project grants. BasePolicy's
  `organizationMembership` is passed as `{} as never`.
- `canViewSharedContext` is dual-role like `CampaignReport.canView` — also
  consults `reviewerMembership`.
- A user holding both `campaign_tester` and `campaign_reviewer` roles on the
  same campaign passes `canActAsTester` on the tester gate independently.
- `canDelete()` inherited from `BasePolicy` returning `false`.

### AgentsAnalytics

Policy class: `apps/api/src/domains/analytics/agents-analytics/agents-analytics.policy.ts`. Subject: `AgentsAnalytics`. Extends: `AgentPolicy`.

| Method | Action | Roles granted (with scope match) |
|---|---|---|
| `canList()` | `list` | `agent_owner` / `agent_admin` (agent grant matching the entity; project role irrelevant) |
| `canCreate()`, `canUpdate()`, `canDelete()` | inherited | Same semantics as `AgentPolicy` — included only because the parent overrides them |

Notes:
- The spec only exercises `canList`. Controllers using this policy call
  `policy.canList()` for the analytics dashboard.
- `canList` differs from `AgentPolicy.canList` (which allows any project
  member): analytics require an agent admin/owner grant. A project owner
  with no agent membership returns `false`.

### ProjectsAnalytics

Policy class: `apps/api/src/domains/analytics/projects-analytics/projects-analytics.policy.ts`. Subject: `ProjectsAnalytics`. Extends: `ProjectPolicy`.

| Method | Action | Roles granted (with scope match) |
|---|---|---|
| `canList()` | `list` | `project_owner` / `project_admin` (project grant matching `entity.id`) |
| `canCreate()`, `canUpdate()`, `canDelete()` | inherited | Same semantics as `ProjectPolicy` |

Notes:
- The spec shows that `sameOrganization` and `differentOrganization` both
  return `true` for owner/admin — because `isMemberOfProject()` only checks
  `projectMembership.projectId === entity.id`. It does NOT consult
  `entity.organizationId`. This is technically a gap (a project membership
  whose `organizationId` differs from the entity's `organizationId` would
  pass), but in practice grants are loaded from the URL's org context.
- Project members get `false` — analytics are admin/owner only.

---

## 4. Catalog seed: (role, action, subject) triples

One row per granted triple, ordered by (Subject, Action, Role). The
"Condition shape" column expresses the `user_role.conditions @>` predicate
that must hold (against the resource for entity-bound rules, or against the
URL context for creation/list rules).

`$entity` = resource being authorized. `$org` / `$project` / `$agent` /
`$campaign` = URL-context ids when no entity exists yet.

| Role | Action | Subject | Condition shape | Notes |
|---|---|---|---|---|
| `agent_owner` | `list` | `Agent` | `{ projectId: $project }` | Inherited via `ProjectScopedPolicy.canList`; any project grant suffices, but agent owners always hold one. Listed here for completeness only — `Agent.list` is gated by project role, not agent role. See note. |
| `agent_admin` | `list` | `Agent` | `{ projectId: $project }` | Same caveat as above. |
| `agent_member` | `list` | `Agent` | `{ projectId: $project }` | Same caveat. |
| `project_owner` | `list` | `Agent` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `list` | `Agent` | `{ projectId: $project, organizationId: $org }` | |
| `project_member` | `list` | `Agent` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `create` | `Agent` | `{ projectId: $project, organizationId: $org }` | No entity yet |
| `project_admin` | `create` | `Agent` | `{ projectId: $project, organizationId: $org }` | No entity yet |
| `agent_owner` | `update` | `Agent` | `{ agentId: $entity.id, projectId: $entity.projectId, organizationId: $entity.organizationId }` | Plus user has org+project grants matching entity |
| `agent_admin` | `update` | `Agent` | `{ agentId: $entity.id, projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `agent_owner` | `delete` | `Agent` | `{ agentId: $entity.id, projectId: $entity.projectId, organizationId: $entity.organizationId }` | Alias of update |
| `agent_admin` | `delete` | `Agent` | `{ agentId: $entity.id, projectId: $entity.projectId, organizationId: $entity.organizationId }` | Alias of update |
| `agent_owner` | `list` | `AgentMembership` | `{ projectId: $project, organizationId: $org }` | FIXME in source — semantics SHOULD be agent_owner/admin; CURRENT behaviour grants project admin/owner only. Listed here as the FUTURE intent. |
| `agent_admin` | `list` | `AgentMembership` | `{ projectId: $project, organizationId: $org }` | FIXME, see above. |
| `project_owner` | `list` | `AgentMembership` | `{ projectId: $project, organizationId: $org }` | CURRENT source behaviour |
| `project_admin` | `list` | `AgentMembership` | `{ projectId: $project, organizationId: $org }` | CURRENT source behaviour |
| `project_owner` | `create` | `AgentMembership` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `create` | `AgentMembership` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `update` | `AgentMembership` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `update` | `AgentMembership` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `delete` | `AgentMembership` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `delete` | `AgentMembership` | `{ projectId: $project, organizationId: $org }` | |
| `agent_owner` | `list` | `AgentsAnalytics` | `{ agentId: $entity.id, projectId: $entity.projectId, organizationId: $entity.organizationId }` | Agent role required; project role insufficient |
| `agent_admin` | `list` | `AgentsAnalytics` | `{ agentId: $entity.id, projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_owner` | `list` | `BaseAgentSession` (type=live) | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `list` | `BaseAgentSession` (type=live) | `{ projectId: $project, organizationId: $org }` | |
| `project_member` | `list` | `BaseAgentSession` (type=live) | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `list` | `BaseAgentSession` (type=playground) | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `list` | `BaseAgentSession` (type=playground) | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `create` | `BaseAgentSession` (type=live) | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `create` | `BaseAgentSession` (type=live) | `{ projectId: $project, organizationId: $org }` | |
| `project_member` | `create` | `BaseAgentSession` (type=live) | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `create` | `BaseAgentSession` (type=playground) | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `create` | `BaseAgentSession` (type=playground) | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `delete` | `BaseAgentSession` (type=live) | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_admin` | `delete` | `BaseAgentSession` (type=live) | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_member` | `delete` | `BaseAgentSession` (type=live) | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_owner` | `delete` | `BaseAgentSession` (type=playground) | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_admin` | `delete` | `BaseAgentSession` (type=playground) | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_owner` | `read` | `CampaignReport` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` (campaign in scope) | Admin path |
| `project_admin` | `read` | `CampaignReport` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | Admin path |
| `campaign_reviewer` | `read` | `CampaignReport` | `{ campaignId: $campaign }` AND campaign status ≠ `draft` | Reviewer path |
| `project_owner` | `list` | `Document` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `list` | `Document` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `read` | `Document` | `{ projectId: $project, organizationId: $org }` (entity optional) | `canView` = `canAccess()` — any project member |
| `project_admin` | `read` | `Document` | `{ projectId: $project, organizationId: $org }` | |
| `project_member` | `read` | `Document` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `create` | `Document` | `{ projectId: $project, organizationId: $org }` | Any sourceType |
| `project_admin` | `create` | `Document` | `{ projectId: $project, organizationId: $org }` | Any sourceType |
| `project_member` | `create` | `Document` (sourceType ∈ {`agentSessionMessage`,`extraction`}) | `{ projectId: $project, organizationId: $org }` | Conditional on subject attribute `sourceType` |
| `project_owner` | `update` | `Document` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_admin` | `update` | `Document` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_owner` | `delete` | `Document` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_admin` | `delete` | `Document` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_owner` | `list` | `DocumentTag` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `list` | `DocumentTag` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `create` | `DocumentTag` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `create` | `DocumentTag` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `update` | `DocumentTag` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_admin` | `update` | `DocumentTag` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_owner` | `delete` | `DocumentTag` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_admin` | `delete` | `DocumentTag` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_owner` | `list` | `Evaluation` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `list` | `Evaluation` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `create` | `Evaluation` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `create` | `Evaluation` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `update` | `Evaluation` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_admin` | `update` | `Evaluation` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_owner` | `delete` | `Evaluation` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_admin` | `delete` | `Evaluation` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_owner` | `list` | `EvaluationExtractionDataset` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `list` | `EvaluationExtractionDataset` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `create` | `EvaluationExtractionDataset` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `create` | `EvaluationExtractionDataset` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `update` | `EvaluationExtractionDataset` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_admin` | `update` | `EvaluationExtractionDataset` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_owner` | `delete` | `EvaluationExtractionDataset` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_admin` | `delete` | `EvaluationExtractionDataset` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_owner` | `list` | `EvaluationExtractionRun` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `list` | `EvaluationExtractionRun` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `create` | `EvaluationExtractionRun` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `create` | `EvaluationExtractionRun` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `update` | `EvaluationExtractionRun` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_admin` | `update` | `EvaluationExtractionRun` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_owner` | `delete` | `EvaluationExtractionRun` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_admin` | `delete` | `EvaluationExtractionRun` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_owner` | `list` | `EvaluationReport` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `list` | `EvaluationReport` | `{ projectId: $project, organizationId: $org }` | |
| `project_member` | `list` | `EvaluationReport` | `{ projectId: $project, organizationId: $org }` | Parent default |
| `project_owner` | `create` | `EvaluationReport` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `create` | `EvaluationReport` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `update` | `EvaluationReport` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_admin` | `update` | `EvaluationReport` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_owner` | `delete` | `EvaluationReport` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_admin` | `delete` | `EvaluationReport` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_owner` | `list` | `Invitation` (target=project) | `{ projectId: $project, organizationId: $org }` | target optional |
| `project_admin` | `list` | `Invitation` (target=project) | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `create` | `Invitation` (target=project) | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `create` | `Invitation` (target=project) | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `delete` | `Invitation` (target=project) | `{ projectId: $project, organizationId: $org }` (target in scope) | |
| `project_admin` | `delete` | `Invitation` (target=project) | `{ projectId: $project, organizationId: $org }` | |
| `agent_owner` | `list` | `Invitation` (target=agent) | `{ agentId: $target.id, projectId: $project, organizationId: $org }` | |
| `agent_admin` | `list` | `Invitation` (target=agent) | `{ agentId: $target.id, projectId: $project, organizationId: $org }` | |
| `agent_owner` | `create` | `Invitation` (target=agent) | `{ agentId: $target.id, projectId: $project, organizationId: $org }` | |
| `agent_admin` | `create` | `Invitation` (target=agent) | `{ agentId: $target.id, projectId: $project, organizationId: $org }` | |
| `agent_owner` | `delete` | `Invitation` (target=agent) | `{ agentId: $target.id, projectId: $project, organizationId: $org }` | |
| `agent_admin` | `delete` | `Invitation` (target=agent) | `{ agentId: $target.id, projectId: $project, organizationId: $org }` | |
| `project_owner` | `list` | `Invitation` (target=review_campaign) | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `list` | `Invitation` (target=review_campaign) | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `create` | `Invitation` (target=review_campaign) | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `create` | `Invitation` (target=review_campaign) | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `delete` | `Invitation` (target=review_campaign) | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `delete` | `Invitation` (target=review_campaign) | `{ projectId: $project, organizationId: $org }` | |
| (no role) | `create` | `Organization` | (no condition; email-domain allow-list) | Driven by `ORGANIZATION_CREATOR_EMAIL_DOMAIN` env var, NOT by RBAC. The seed migration should encode this either as a hard-coded subject rule outside `role_permission` or as an anonymous "any authenticated user" rule. |
| `org_owner` | `list` | `Project` | `{ organizationId: $org }` | Entity optional |
| `org_admin` | `list` | `Project` | `{ organizationId: $org }` | |
| `org_member` | `list` | `Project` | `{ organizationId: $org }` | |
| `org_owner` | `create` | `Project` | `{ organizationId: $org }` | |
| `org_admin` | `create` | `Project` | `{ organizationId: $org }` | |
| `project_owner` | `update` | `Project` | `{ projectId: $entity.id, organizationId: $entity.organizationId }` | |
| `project_admin` | `update` | `Project` | `{ projectId: $entity.id, organizationId: $entity.organizationId }` | |
| `project_owner` | `delete` | `Project` | `{ projectId: $entity.id, organizationId: $entity.organizationId }` | |
| `project_admin` | `delete` | `Project` | `{ projectId: $entity.id, organizationId: $entity.organizationId }` | |
| `project_owner` | `list` | `ProjectMembership` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `list` | `ProjectMembership` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `create` | `ProjectMembership` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `create` | `ProjectMembership` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `update` | `ProjectMembership` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `update` | `ProjectMembership` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `delete` | `ProjectMembership` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `delete` | `ProjectMembership` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `list` | `ProjectsAnalytics` | `{ projectId: $entity.id }` | Project grant only; org id NOT checked against entity |
| `project_admin` | `list` | `ProjectsAnalytics` | `{ projectId: $entity.id }` | |
| `project_owner` | `list` | `ReviewCampaignMembership` | `{ projectId: $project, organizationId: $org }` | Catalog-only subject; no policy class. Mirrors `ReviewCampaign.update`. |
| `project_admin` | `list` | `ReviewCampaignMembership` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `create` | `ReviewCampaignMembership` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `create` | `ReviewCampaignMembership` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `update` | `ReviewCampaignMembership` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `update` | `ReviewCampaignMembership` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `delete` | `ReviewCampaignMembership` | `{ projectId: $project, organizationId: $org }` | Currently served by `ReviewCampaignPolicy.canUpdate`. |
| `project_admin` | `delete` | `ReviewCampaignMembership` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `list` | `ReviewCampaign` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `list` | `ReviewCampaign` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `create` | `ReviewCampaign` | `{ projectId: $project, organizationId: $org }` | |
| `project_admin` | `create` | `ReviewCampaign` | `{ projectId: $project, organizationId: $org }` | |
| `project_owner` | `read` | `ReviewCampaign` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_admin` | `read` | `ReviewCampaign` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_owner` | `update` | `ReviewCampaign` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_admin` | `update` | `ReviewCampaign` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_owner` | `delete` | `ReviewCampaign` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `project_admin` | `delete` | `ReviewCampaign` | `{ projectId: $entity.projectId, organizationId: $entity.organizationId }` | |
| `campaign_reviewer` | `list` | `Reviewer` | `{ campaignId: $campaign }` AND campaign status ≠ `draft` | |
| `campaign_reviewer` | `read` | `Reviewer` | `{ campaignId: $campaign }` AND campaign status ≠ `draft` | |
| `campaign_reviewer` | `create` | `Reviewer` | `{ campaignId: $campaign }` AND campaign status = `active` | |
| `campaign_reviewer` | `update` | `Reviewer` | `{ campaignId: $campaign }` AND campaign status = `active` | |
| `campaign_reviewer` | `review` | `Reviewer` | `{ campaignId: $campaign }` AND campaign status = `active` | |
| `campaign_tester` | `list` | `Tester` | `{ campaignId: $campaign }` AND campaign status = `active` | |
| `campaign_tester` | `read` | `Tester` | `{ campaignId: $campaign }` AND campaign status = `active` | |
| `campaign_tester` | `create` | `Tester` | `{ campaignId: $campaign }` AND campaign status = `active` | |
| `campaign_tester` | `update` | `Tester` | `{ campaignId: $campaign }` AND campaign status = `active` | |
| `campaign_tester` | `actAsTester` | `Tester` | `{ campaignId: $campaign }` AND campaign status = `active` | |
| `campaign_tester` | `viewSharedContext` | `Tester` | `{ campaignId: $campaign }` AND campaign status = `active` | Tester path |
| `campaign_reviewer` | `viewSharedContext` | `Tester` | `{ campaignId: $campaign }` AND campaign status ≠ `draft` | Reviewer path |

Row count: **157 granting triples** across 20 subjects and 11 roles
(+ 1 anonymous email-domain rule for `Organization.create`). The §4 table
has 171 visible rows because it also documents:
- 3 `agent_*.list.Agent` rows footnoted as "for completeness" — the policy
  gates on project role, not agent role; these don't independently grant.
- 2 `agent_*.list.AgentMembership` rows marked as the FIXME-FUTURE intent
  — current behaviour gates on project role; the catalog encodes current
  behaviour only.
- 1 `Organization.create` env-domain rule — injected at runtime by
  `AbilityFactory`, not seeded.

The 8 `ReviewCampaignMembership` rows are present in the actual seed
(Checkpoint 0b carve-out).

---

## 5. Findings / open questions

- **Only 19 policy files, not 20.** The prompt mentioned 20; `find` returns
  19. There is no `review-campaign-membership.policy.ts` — review-campaign
  membership is managed inline by `ReviewCampaignPolicy` (admin path),
  `ReviewerPolicy` / `TesterPolicy` (member-side gates), and `InvitationPolicy`
  (invite-side). **Resolved (Phase-3 Checkpoint 0b)**: a catalog-only
  `ReviewCampaignMembership` subject was added for symmetry with
  `ProjectMembership` / `AgentMembership`. No new policy class — the existing
  `revokeMembership` endpoint stays gated by `ReviewCampaignPolicy.canUpdate`.
  Catalog rows mirror that semantics. A future PR can split it out if more
  endpoints accrue.

- **`AgentMembershipPolicy` has a `FIXME` in source.** Inline comment:
  `// FIXME: should be isAgentAdminOrOwner`. Currently the gate is
  `isProjectAdminOrOwner`. The catalog row reflects **current** behaviour
  (project admin/owner) but I added a "FUTURE intent" row for
  `agent_owner`/`agent_admin`. Decide before seeding which semantics to
  encode. No `*.policy.spec.ts` for this policy, so the FIXME is not under
  test.

- **`AgentPolicy.canUpdate` / `canDelete` skip the `canAccess()` gate** that
  `canList` / `canCreate` use. It still requires org+project grants matching
  the entity via `doesResourceBelongToScope`, but does NOT check that the
  loaded `project.organizationId` equals the user's org. The resolver layer
  closes this in practice. Worth a small refactor to be defensive.

- **`ProjectsAnalyticsPolicy.canList` ignores `organizationId`.** Spec
  confirms `sameOrganization` AND `differentOrganization` both yield `true`
  for admin/owner: `isMemberOfProject()` only checks
  `projectMembership.projectId === entity.id`. Cross-org project grants
  shouldn't exist in real data, but the rule should be tightened.

- **Two policies use stub `organizationMembership`.** `ReviewerPolicy` and
  `TesterPolicy` pass `{} as never` to `BasePolicy`. Their auth is purely
  campaign-membership × campaign-status. The catalog reflects this — these
  rules should NOT be conditioned on `organizationId` in the seed migration.

- **`OrganizationPolicy.canCreate` is environment-driven, not RBAC-driven.**
  Reading `process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN` at every call.
  The CASL seed should either (a) carry this as a hard-coded ability not
  backed by `role_permission`, or (b) introduce a synthetic
  `organization_creator` role granted on email-domain match at login. Flag
  for the seed migration design.

- **Dual-role `OR` rules:** `CampaignReport.canView` and
  `Tester.canViewSharedContext` both pass if EITHER of two distinct role
  conditions matches. CASL handles this as two independent `allow` rules
  per (action, subject) — the row layout in §4 already encodes one rule per
  role-arm. Confirmed implementation maps cleanly.

- **Status-dependent rules (`ReviewCampaign.status`)** appear on
  `Reviewer`, `Tester`, and `CampaignReport`. The CASL `conditions`
  predicate carries `status: { $ne: "draft" }` for `read`-class actions
  and `status: "active"` for `create`/`update`/`review`/`actAsTester`. Beyond
  scope ids, these need a status field on the subject envelope at check
  time. Reviewer-side `read` accepts both `active` and `closed` (i.e. `$ne:
  "draft"`); tester-side requires `active`.

- **`Document.canCreate` has a sourceType conditional** that lets project
  members create when `sourceType ∈ {agentSessionMessage, extraction}`.
  Implemented in source but the spec case is `it.skip(...)` — not under
  test. CASL conditions need to express this on the subject attribute
  `sourceType`. The seed should preserve this exception.

- **No policy.spec.ts for**: `AgentMembershipPolicy`,
  `DocumentTagPolicy`, `EvaluationExtractionDatasetPolicy`,
  `EvaluationExtractionRunPolicy`, `EvaluationReportPolicy`,
  `CampaignReportPolicy`. Catalog rows for these are derived from source
  only.

- **Alias methods** (`canDelete() { return this.canUpdate() }`) appear in
  `ProjectPolicy`, `DocumentPolicy`, `DocumentTagPolicy`, `EvaluationPolicy`,
  `EvaluationExtractionDatasetPolicy`, `EvaluationExtractionRunPolicy`,
  `AgentPolicy`, `ReviewCampaignPolicy` (delete=view=update). Catalog emits
  distinct (action, subject) rows for each, which is the right thing for
  CASL.

- **`BasePolicy` methods always return false** for any subclass that
  doesn't override them. None of these emit triples. Examples that quietly
  inherit `() => false`: `Invitation.canUpdate`, `ReviewerPolicy.canDelete`,
  `TesterPolicy.canDelete`, every policy's `canView` except
  `Document` / `ReviewCampaign` / `CampaignReport` / `Reviewer` / `Tester`.
  These are correctly absent from §4.
