# RBAC migration — Phase 4 execution plan

This is a hand-off plan for the next session(s) executing the Phase 4 hard cutover. It picks up from the post-Phase-2 state (8 commits/branches behind whatever you're reading from — verify with `git log`).

**Goal**: replace the 4 legacy membership tables (`organization_membership`, `project_membership`, `agent_membership`, `review_campaign_membership`) with the existing `user_role` table everywhere — writes, reads, tests, migrations. Drop the legacy tables. Keep the API DTO contract stable so the frontend keeps working (frontend rewrite is a follow-up).

---

## 0. Pre-flight: what's already in place (Phases 0–2)

- **Entities**: `Role`, `Permission`, `RolePermission`, `UserRole` exist under [apps/api/src/domains/rbac/](apps/api/src/domains/rbac/). `User.attributes` JSONB column added.
- **Migrations applied**:
  - `1779890975157-init-rbac-abac.ts` — DDL for the 4 RBAC tables + `user.attributes` + expression indexes on `user_role.conditions->>{organizationId,projectId,agentId,campaignId}`.
  - `1779893621589-seed-rbac-roles-and-backfill.ts` — seeds 11 roles + backfills `user_role` from the 4 legacy membership tables (idempotent via `NOT EXISTS`).
- **RbacService** at [apps/api/src/domains/rbac/rbac.service.ts](apps/api/src/domains/rbac/rbac.service.ts) — read-only adapter:
  - `loadUserGrants(userId)` reads `user_role` (forward-looking).
  - `organizationRole / projectRole / agentRole / campaignRoles` **currently read from the legacy tables** (Phase-2 compatibility shim). These need to flip in Phase 4.
- **RbacModule** at [apps/api/src/domains/rbac/rbac.module.ts](apps/api/src/domains/rbac/rbac.module.ts) — exports `RbacService`; imports the 4 legacy membership entities (remove in Phase 4).
- **Resolvers rewired** (5 of 7 use `RbacService`; 2 still read legacy tables):
  - `organization-context`, `project-context`, `agent-context`, `review-campaign-membership-context`, `invitation-scope-context` → `RbacService`.
  - `project-membership-context`, `agent-membership-context` → still read legacy tables directly (they load a *target* membership row by id for management routes). Phase 4 changes these to read `user_role` by id.
- **Modules**: 11 modules + [base-agent-sessions-module.helpers.ts](apps/api/src/domains/agents/base-agent-sessions/base-agent-sessions-module.helpers.ts) already import `RbacModule`.
- **Frontend**: untouched. Still consumes legacy DTO shapes via [studio/features/project-memberships/](apps/web/src/studio/features/project-memberships/) and [studio/features/agent-memberships/](apps/web/src/studio/features/agent-memberships/). `me` returns 4 membership arrays. Out of scope for Phase 4.

Verify all of the above with `git log src/domains/rbac/` before starting.

---

## 1. Success criteria

A Phase-4 PR is done when **all** of these hold:

1. `make tests-parallel` is green (1406+ tests).
2. `npm run typecheck`, `npm run biome:ci`, `npm run check:boundaries` are green.
3. `grep -rn "OrganizationMembership\|ProjectMembership\|AgentMembership\|ReviewCampaignMembership" apps/api/src` returns no production-code matches (test infra excluded if any). The 4 entities and factories no longer exist as files.
4. `psql connect -c "\dt" | grep _membership` returns nothing — the 4 legacy tables are dropped.
5. `RbacService.{organizationRole,projectRole,agentRole,campaignRoles}` read from `user_role` only. The legacy repositories are gone from its constructor.
6. The `me` endpoint response shape (`organizationMemberships[]`, `projectMemberships[]`, `agentMemberships[]`, `reviewCampaignMemberships[]`) is **unchanged** at the API contract level (frontend must keep working).
7. The `project-memberships` and `agent-memberships` controllers continue to serve their existing routes with the same response DTO shapes (sourced from `user_role`).
8. Invitation accept-flows create `user_role` rows; no INSERT into legacy tables.

---

## 2. Execution order with checkpoints

The order below is designed so each checkpoint leaves the API in a working state. Don't skip ahead — every checkpoint runs `make tests-parallel` to green before moving on.

### Checkpoint A: RbacService write surface

Add the four primitives that downstream code will use. Pure addition — nothing changes behaviorally yet.

Add to [apps/api/src/domains/rbac/rbac.service.ts](apps/api/src/domains/rbac/rbac.service.ts):

```ts
// Inside RbacService

async grantRole(params: {
  userId: string
  roleName: RbacRoleName
  conditions: Record<string, unknown>
  manager?: EntityManager
}): Promise<UserRole>

async upsertGrantRoleUpgrade(params: {
  userId: string
  conditions: Record<string, unknown>      // narrower than grant — matches an existing scope
  fromRoles: RbacRoleName[]               // e.g. ["org_member"] → match these
  toRole: RbacRoleName                     // → upgrade match to this
  manager?: EntityManager
}): Promise<UserRole>

async revokeGrant(params: {
  userId: string
  roleName: RbacRoleName
  conditions: Record<string, unknown>
  manager?: EntityManager
}): Promise<void>

async listGrantsByScope(params: {
  conditions: Record<string, unknown>      // e.g. { projectId: "..." } — partial match
  rolePrefix: "org_" | "project_" | "agent_" | "campaign_"
}): Promise<Array<{ id: string; userId: string; roleName: RbacRoleName; conditions: Record<string, unknown> }>>

async findGrantById(grantId: string): Promise<UserRole | null>
```

Implementation notes:
- All write methods accept an optional `EntityManager` so they can run inside a transaction owned by the caller.
- `grantRole` resolves the role-id from `roleName` via the `role` table (cache the lookup table at module init — 11 rows that never change post-seed).
- `conditions` JSON equality is awkward in Postgres because key order matters. Use a canonical sort (e.g. `JSON.stringify(canonicalize(obj))`) when comparing, or `WHERE conditions @> $1 AND $1 @> conditions` to do a containment match.
- Add a unique partial index in a new migration: `CREATE UNIQUE INDEX uq_user_role_scope ON user_role (user_id, role_id, md5(conditions::text)) WHERE deleted_at IS NULL;`. This is what Phase 0 deferred (plan §6 risk #3).

Add a spec [apps/api/src/domains/rbac/rbac.write.service.spec.ts](apps/api/src/domains/rbac/rbac.write.service.spec.ts) covering: grant creates a row; grant is idempotent; revoke soft-deletes; upgrade flips role; list by scope returns matches.

**Checkpoint A done when:** new methods exist, write spec is green, full suite is green, RbacService still reads from legacy tables (no behavior change).

---

### Checkpoint B: Migrate write sites to dual-write

Update every legacy-membership write site to also call `RbacService.grantRole/revokeGrant/upgrade`. The legacy writes stay (don't remove them yet). After this checkpoint, `user_role` is a perfect mirror of the legacy tables in real time, on top of the Phase-1 backfill.

Sites (in dependency order — services with no dependents first):

1. **[organization-account-provisioning.service.ts](apps/api/src/domains/organizations/provisioning/organization-account-provisioning.service.ts)** — line 78–83 creates owner `OrganizationMembership`. Add a paired `RbacService.grantRole({ roleName: "org_owner", conditions: { organizationId: savedOrganization.id } })`.

2. **[workspace-invitation.service.ts](apps/api/src/domains/organizations/provisioning/workspace-invitation.service.ts)** — line 93–104 ensures admin `OrganizationMembership`. Add paired `grantRole({ roleName: "org_admin", … })` (or upgrade from member → admin). Note: this service is a class without `@Injectable` and is wired manually somewhere — find the call-site and pass `RbacService` through.

3. **[invitation-acceptance-helpers.service.ts](apps/api/src/domains/invitations/handlers/invitation-acceptance-helpers.service.ts)** — `ensureOrganizationMembership` and `ensureProjectMembership`. These two methods are the central upsert path for all 3 invitation handlers. Inject `RbacService`; after each legacy upsert, call `RbacService.upsertGrantRoleUpgrade(...)` to mirror.

4. **[project-invitation.handler.ts](apps/api/src/domains/invitations/handlers/project-invitation.handler.ts)** — uses helpers above + `promoteToAdminIfNeeded` writes `ProjectMembership` directly (line 267–283). Mirror to `user_role`.

5. **[agent-invitation.handler.ts](apps/api/src/domains/invitations/handlers/agent-invitation.handler.ts)** — line 258–266 creates `AgentMembership` directly. Mirror to `user_role`.

6. **[review-campaign-invitation.handler.ts](apps/api/src/domains/invitations/handlers/review-campaign-invitation.handler.ts)** — `upsertCampaignMembership` line 309–336. Mirror to `user_role` (`campaign_tester` or `campaign_reviewer`).

7. **[projects.service.ts](apps/api/src/domains/projects/projects.service.ts)** — `createProject` calls `projectMembershipsService.createProjectOwnerMembership`. Update *inside* `createProjectOwnerMembership` rather than here.

8. **[project-memberships.service.ts](apps/api/src/domains/projects/memberships/project-memberships.service.ts)**:
   - `createProjectOwnerMembership` → also `grantRole({ roleName: "project_owner", conditions: { organizationId, projectId } })`. **You'll need to look up `organizationId`** — fetch the project once and pass it.
   - `upsertProjectAdminMembership` → also `upsertGrantRoleUpgrade(...)`.
   - `removeProjectMembership` → also `revokeGrant(...)` for that user's `project_*` row. Also cascade-revoke their `agent_*` grants for agents in that project (mirrors the existing `deleteAgentMembershipsForUserInProject` call).

9. **[agents.service.ts](apps/api/src/domains/agents/agents.service.ts)** — `createAgent` calls `agentMembershipsService.createAgentOwnerMembership` + `createAdminAgentMembershipsForProjectAdmins`. `deleteAgent` line 256–257 deletes `AgentMembership`. Mirror these.

10. **[agent-memberships.service.ts](apps/api/src/domains/agents/memberships/agent-memberships.service.ts)** — every method:
    - `createAgentOwnerMembership` → grant `agent_owner` with `{ organizationId, projectId, agentId }`.
    - `upsertAgentMemberMembership` → grant or upsert `agent_member`.
    - `removeAgentMembership` → revoke.
    - `createAdminAgentMembershipsForUserInProject` → loop + grant `agent_admin` per agent.
    - `createAdminAgentMembershipsForProjectAdmins` → loop + grant `agent_admin`.
    - `deleteAgentMembershipsForUserInProject` → revoke each agent grant.

11. **[projects.service.ts](apps/api/src/domains/projects/projects.service.ts) `deleteProject`** — line 88 deletes `ProjectMembership` for the project. Mirror: revoke all `project_*` grants where `conditions->>'projectId' = $projectId`. (For nested agents, the existing `deleteAgent` loop already handles them.)

**Per-site test:** for each site, ensure existing specs still pass. Add a quick assertion that `user_role` has the matching row (use `repositories.userRoleRepository.findOne(...)` in 1-2 critical spec files like `organization-account-provisioning.service.spec.ts`).

**Checkpoint B done when:** every write site dual-writes; `make tests-parallel` is green; manual SQL check: pick any organization in dev DB, confirm `user_role` rows match `organization_membership + project_membership + agent_membership` rows 1:1.

---

### Checkpoint C: Flip RbacService reads to `user_role`

Now that `user_role` is authoritative (Checkpoint B), revert the Phase-2 legacy shim in [rbac.service.ts](apps/api/src/domains/rbac/rbac.service.ts):

```ts
async organizationRole(userId, organizationId) {
  const grants = await this.loadUserGrants(userId)
  // …same projection logic as Phase-1's original implementation (see git history)
}
```

- Remove `@InjectRepository(OrganizationMembership / ProjectMembership / AgentMembership / ReviewCampaignMembership)` from the constructor.
- Update [rbac.module.ts](apps/api/src/domains/rbac/rbac.module.ts) to drop the 4 legacy entities from `TypeOrmModule.forFeature`.
- Update [rbac.service.spec.ts](apps/api/src/domains/rbac/rbac.service.spec.ts): tests should seed `user_role` rows (the Phase-1 spec style), not legacy tables. Revert the spec to roughly the Phase-1 shape but keep the "test factories that seed legacy + grant" pattern below.
- Update **test factories**: the existing `userMembershipFactory.build({ ... })` callers create legacy rows. Add `grantRoleForTest(repositories, { user, organization, role })` helper in [test-all-repositories.ts](apps/api/src/common/test/test-all-repositories.ts) (or a new helper file) that creates the `user_role` row. Have specs use both factories during the transition — OR rewrite the membership factories themselves to create `user_role` rows under the hood. The latter is fewer test changes.

**The trick is test factories.** ~30 e2e specs use `userMembershipFactory.owner()`, `projectMembershipFactory.admin()`, etc. Rewriting all of them is the largest test cost. The pragmatic move: rewrite the 4 factories themselves to insert `user_role` rows instead of legacy rows. Callers don't change. Verify by running the test suite.

**Checkpoint C done when:**
- RbacService no longer references legacy entities;
- legacy repositories removed from RbacModule;
- spec rewritten to seed user_role;
- the 4 membership factories rewritten to create `user_role` rows (so existing test specs keep passing);
- `make tests-parallel` is green.

---

### Checkpoint D: Reshape `me.service.ts`

[me.service.ts](apps/api/src/domains/me/me.service.ts) currently reads 4 membership tables and returns 4 arrays of `*Membership` entities. Reshape it to:

1. Read `user_role` rows for the user, joined with `role`.
2. Bucket by role-name prefix (`org_*` → `organizationMemberships`, `project_*` → `projectMemberships`, etc.).
3. For each bucket, build the legacy-shape DTO from the grant. **You'll need to fetch organization/project/agent/campaign metadata** because the current DTO eager-loads `organization` / `project` / `agent` / `campaign` relations. Do this with batched `In(...)` queries from the IDs in `conditions`.

```ts
const grants = await this.userRoleRepo.find({ where: { userId }, relations: ["role"] })
const orgIds = grants.filter(...).map(g => g.conditions.organizationId)
const orgs   = await this.orgRepo.find({ where: { id: In(orgIds) } })
// …build OrganizationMembership-shaped objects with embedded org, etc.
```

Inject `Organization`, `Project`, `Agent`, `ReviewCampaign` repos into MeService. Remove the 4 legacy repos.

**This is the most contract-sensitive change.** Test it against the existing me e2e spec to ensure DTO equivalence (`expect(response.body.data).toMatchObject(...)`).

**Checkpoint D done when:** `me` returns identical DTO shape sourced from `user_role`; me service no longer imports legacy entities; me spec green.

---

### Checkpoint E: Reshape membership-management services

[project-memberships.service.ts](apps/api/src/domains/projects/memberships/project-memberships.service.ts) and [agent-memberships.service.ts](apps/api/src/domains/agents/memberships/agent-memberships.service.ts) expose the controllers' read/delete routes. Reshape:

- `findById(membershipId)` → `RbacService.findGrantById(id)` (returns a `user_role` row).
- `listProjectMemberships(projectId)` → `listGrantsByScope({ conditions: { projectId }, rolePrefix: "project_" })`. Project to the DTO with user data joined.
- `removeProjectMembership({ membershipId, projectId, userId })` → fetch grant by id; verify the grant's `projectId` matches; revoke. Cascade-revoke agent grants. Cleanup placeholder user.
- `listAgentMemberships(agentId)`, `removeAgentMembership(...)` — analogous.
- `listMemberAgents(...)` and `createAdmin*` / `delete*` helpers — rewrite against `user_role`.

**Critical**: the controllers' URL param `membershipId` now refers to `user_role.id`. This means clients holding old `project_membership.id` UUIDs will 404 after deploy. Document this. The frontend reads ids freshly from `me`, so it'll just work — but anything bookmarking a membership-management URL won't.

Once the services are reshaped to use `user_role`, the [project-membership-context.resolver.ts](apps/api/src/common/context/resolvers/project-membership-context.resolver.ts) and [agent-membership-context.resolver.ts](apps/api/src/common/context/resolvers/agent-membership-context.resolver.ts) similarly switch to `user_role` lookups.

**Checkpoint E done when:** all membership-management routes work, e2e tests for project-memberships and agent-memberships green.

---

### Checkpoint F: Reshape review-campaigns reads

[review-campaigns.service.ts](apps/api/src/domains/review-campaigns/review-campaigns.service.ts) — `listCampaigns` likely joins `review_campaign_membership` for member counts. Switch to a join on `user_role` filtered by `conditions->>'campaignId' = campaign.id` and `role.name LIKE 'campaign_%'`.

Also check [tester.service.ts](apps/api/src/domains/review-campaigns/tester/tester.service.ts) and [reviewer.service.ts](apps/api/src/domains/review-campaigns/reviewer/reviewer.service.ts) — they currently read `review_campaign_membership` for "is this user a tester/reviewer on this campaign?" Now go through `RbacService.campaignRoles`.

**Checkpoint F done when:** review-campaign listings + tester/reviewer endpoints return correct data; review-campaign e2e tests green.

---

### Checkpoint G: Remove legacy writes

Now that everything reads `user_role`, remove the dual-writes. Every site that you added `RbacService.grant/revoke` to in Checkpoint B keeps only the RbacService call; the legacy table insert/update/delete goes away.

After this checkpoint, the legacy tables are read-by-nobody, written-by-nobody. They exist only in the schema.

**Checkpoint G done when:** `grep -rn "membershipRepository.save\|membershipRepository.create\|membershipRepository.delete" src/` returns no production-code hits in the 4 legacy domains; full suite green.

---

### Checkpoint H: Final migration — drop legacy tables

Generate a hand-written migration (`migration:create`):

```ts
export class DropLegacyMembershipTables<ts>... {
  async up(qr) {
    // Defensive: re-run the user_role backfill once more in case anything was written between deploy and this migration run
    // (use the same SQL as 1779893621589-seed-rbac-roles-and-backfill.ts — copy/paste the INSERT statements)
    await qr.query(...)

    await qr.query(`DROP TABLE "review_campaign_membership"`)
    await qr.query(`DROP TABLE "agent_membership"`)
    await qr.query(`DROP TABLE "project_membership"`)
    await qr.query(`DROP TABLE "organization_membership"`)
  }
  async down(qr) {
    // Recreate empty tables. Data lost is acceptable — user_role is the source of truth post-Phase-4.
    // Copy the CREATE TABLE statements from history (see 1770803458597-create-project-membership.ts,
    // 1774543659798-add-project-membership-mig.ts, 1774269635228-organization-membership.ts,
    // 1776930037268-review-campaigns-foundation.ts).
  }
}
```

Run locally + run + revert + re-run.

**Checkpoint H done when:** dropping migration applies cleanly; full suite still green; `psql … -c "\dt" | grep _membership` returns nothing.

---

### Checkpoint I: Delete dead code

Remove files:
- [apps/api/src/domains/organizations/memberships/](apps/api/src/domains/organizations/memberships/) — entire directory.
- [apps/api/src/domains/projects/memberships/project-membership.entity.ts](apps/api/src/domains/projects/memberships/project-membership.entity.ts), `project-membership.factory.ts`.
- [apps/api/src/domains/agents/memberships/agent-membership.entity.ts](apps/api/src/domains/agents/memberships/agent-membership.entity.ts), `agent-membership.factory.ts`.
- [apps/api/src/domains/review-campaigns/memberships/](apps/api/src/domains/review-campaigns/memberships/) — entire directory.

The `project-memberships.service.ts`, `project-memberships.controller.ts`, `agent-memberships.service.ts`, `agent-memberships.controller.ts`, policies, guards **stay** — they expose API routes, just reshaped to `user_role`.

Update:
- [all-entities.ts](apps/api/src/common/all-entities.ts) — remove 4 entities.
- [test-all-repositories.ts](apps/api/src/common/test/test-all-repositories.ts) — remove 4 repos.
- [test-database.ts](apps/api/src/common/test/test-database.ts) — remove 4 `DELETE FROM` lines.
- [user.entity.ts](apps/api/src/domains/users/user.entity.ts) — remove 4 `@OneToMany` relations to memberships.
- [user.factory.ts](apps/api/src/domains/users/user.factory.ts) — remove the 4 relation defaults.
- Anywhere else importing the 4 deleted entities: replace with `user_role` lookups.

Regenerate dep-cruiser baseline (the 8 cross-domain entity imports I absorbed in Phase 2 should no longer exist):

```
cd apps/api
npm run check:deps:baseline
npm run check:boundaries
```

**Checkpoint I done when:** the 4 entity files are gone, `npm run typecheck` is green, baseline shrunk by ~8 cross-domain entries.

---

## 3. Test impact (rough estimate)

Specs that import one of the 4 membership entities or factories (count from `grep -rn` on Phase-2 state, ~40 files):

- `*.service.spec.ts` × ~15 — change factories or grant helpers.
- `*.policy.spec.ts` × ~10 — these synthesize memberships; if Checkpoint C rewrites the factories to create `user_role` rows, these pass unchanged.
- `e2e-tests/auth.spec.ts` × ~15 — use `createContextForRole(role)` which builds memberships through factories. Factory rewrite covers this.
- `e2e-tests/*.spec.ts` (functional) — use `createContext()` which assumes owner. Factory rewrite covers this.

The factory rewrite at Checkpoint C is the leverage move. If done right, only a handful of specs need direct edits.

---

## 4. Migrations to generate

Two new migrations needed:

1. **Checkpoint A** — add unique partial index on `user_role(user_id, role_id, md5(conditions::text)) WHERE deleted_at IS NULL`. Done with `migration:create` (DDL only, no entity change), name: `add-user-role-scope-unique-index`.

2. **Checkpoint H** — drop the 4 legacy tables + final backfill re-sync. Done with `migration:create`, name: `drop-legacy-membership-tables`.

No `migration:generate` runs — schema changes are entity-deletion-only at Checkpoint I, which doesn't require DDL (the DROP TABLE happened in H).

---

## 5. Risks & rollback

**Highest-risk checkpoints:**
- **Checkpoint C (read flip)**: if the factory rewrite misses an edge case, ~30 specs fail at once. Mitigation: split this checkpoint — rewrite factories first (verify suite green), then flip RbacService reads.
- **Checkpoint D (me reshape)**: contract-sensitive. The me DTO has eager-loaded relations. Diff the response body in a spec against a golden fixture before and after.
- **Checkpoint H (drop tables)**: irreversible in prod. The `down()` recreates empty tables. **Verify the final backfill re-sync in `up()` runs before the DROPs** — drift between Checkpoint G and H means rows lost.

**Rollback notes:**
- If a checkpoint fails after merging, revert just that checkpoint's PR.
- Checkpoints A through F are individually revertable (legacy writes still happen).
- Checkpoint G removes the legacy-write safety net. Don't merge G and H in the same PR; deploy G, soak for a release, then deploy H.

---

## 6. Open questions to resolve before starting

1. **Does the frontend hold any `project_membership.id` UUIDs in long-lived state (e.g. recently-viewed lists)?** If yes, those become invalid post-Checkpoint E (since `user_role.id` ≠ `project_membership.id`). Solution: have the new migration's backfill UPDATE `user_role.id` to match the corresponding `project_membership.id` for project-membership grants — preserving id stability.
2. **Activity tracking**: [activities/track-activity.decorator.ts](apps/api/src/domains/activities/track-activity.decorator.ts) writes activity rows with `entityId` referencing `memberProjectMembership.id` / `memberAgentMembership.id`. After Checkpoint H, those FKs point at dropped tables. Are activity records sacrosanct (need preservation)? Or is `entityId` a loose ref? If loose, no action. If FK, the activity entity schema needs a column type widening.
3. **Backoffice / scripts**: [backoffice.service.ts](apps/api/src/domains/backoffice/backoffice.service.ts), [scripts/seed-review-campaign-tester.ts](apps/api/src/scripts/seed-review-campaign-tester.ts), [scripts/invite-organization-owners.ts](apps/api/src/scripts/invite-organization-owners.ts) — each touches a membership table directly. Sweep and rewrite at Checkpoint B time.

---

## 7. Estimated effort

Conservative, with full test runs between checkpoints:

| Checkpoint | Effort | Risk |
|---|---|---|
| A — RbacService writes | 0.5 day | low |
| B — Dual-write at all sites | 1.5 days | medium |
| C — Flip reads + factory rewrite | 1 day | high |
| D — Reshape me | 0.5 day | medium |
| E — Reshape membership services | 0.5 day | medium |
| F — Reshape review-campaigns | 0.5 day | low |
| G — Remove legacy writes | 0.5 day | low |
| H — Drop tables migration | 0.5 day | high (irreversible) |
| I — Delete dead code | 0.5 day | low |
| **Total** | **~6 days** | |

Land each checkpoint as its own PR. Don't combine — the value of incremental rollback is high here.

---

## 8. After Phase 4

Once Phase 4 is green:

- **Phase 4-FE** (deferred frontend work): reshape `me` DTO to single `userRoles[]`, delete frontend `project-memberships` / `agent-memberships` features, build a new `user-roles` feature per ADR 0011 §10 checklist.
- **Phase 3** (CASL adoption, originally next): now safe to revisit. The catalog seed (permissions + role_permissions) was deferred from Phase 1 — land it as the first PR of Phase 3. Then install `@casl/ability`, replace the 10 policy classes with `defineAbilityFor(userId)` consulting `RbacService.loadUserGrants`.

---

## 9. Where to look in the codebase

Quick reference for the next session:

- **The plan that birthed all this**: original investigation by the Plan agent in conversation history. Key constraints captured in §1 (per-grant conditions), §2 (catalog), §3 (data migration), §6 (risks).
- **What's been done so far**:
  - Phase 0 commit: `feat: add RBAC+ABAC schema` (entities, migration, registrations).
  - Phase 1 commit: `feat: RbacService + role backfill` (RbacService.loadUserGrants reads user_role; Migration B seeds + backfills).
  - Phase 2 commit: `refactor: route resolvers through RbacService` (7 resolvers; RbacService.per-scope methods read legacy as a Phase-2 shim).
- **The Phase-2 shim to revert**: the legacy-table reads in [rbac.service.ts](apps/api/src/domains/rbac/rbac.service.ts) lines 78–122. The shape Phase-1 had originally (reading from `loadUserGrants` and projecting by prefix) is recoverable from git history.
- **Test factories to rewrite**: `userMembershipFactory`, `projectMembershipFactory`, `agentMembershipFactory`, `reviewCampaignMembershipFactory`. Pattern they should follow at the end of Phase 4: build legacy-shape objects but `.save()` to `user_role` under the hood (synthesizing `id` so downstream specs reading `membership.id` still work).
