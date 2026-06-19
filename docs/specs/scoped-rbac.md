# Spec: Scoped RBAC

> Status: Draft
> Authors: engineering
> Last updated: 2026-06-19

---

## Part I — Authorization Model

_This section is the source-of-truth authorization model that drives the implementation below._

### Overview

The system is based on **Role-Based Access Control (RBAC)** with **resource scoping** and **role assignment inheritance**.

Primary goals:

- Multi-tenant organizations
- Project-level collaboration
- Resource-specific access control
- Fine-grained permissions
- Future extensibility
- Elimination of dedicated membership tables

The model replaces membership tables with a generic role assignment mechanism.

---

### Core Concepts

#### Permissions

Permissions represent atomic actions.

Examples:

- `organization.read`
- `organization.update`
- `project.read`
- `project.update`
- `project.members.manage`
- `agent.read`
- `agent.create`
- `agent.update`
- `agent.delete`
- `chat_session.read`
- `chat_session.create`
- `chat_session.delete`

Permissions are never assigned directly to users.
Permissions belong to roles.

---

#### Roles

Roles are collections of permissions.

Examples:

- `org_owner`
- `org_admin`
- `org_member`
- `project_admin`
- `project_member`
- `project_viewer`
- `agent_editor`
- `agent_viewer`

Roles answer: _What can the user do?_

A role does not grant access by itself. A role must be assigned to a resource.

---

#### Role Assignments

Role assignments associate a role with a specific resource.

Examples:

- Didier → `org_owner` → Organization #1
- Alice → `project_admin` → Project #42
- Bob → `agent_viewer` → Agent #123

Role assignments answer: _Where can the user do it?_

A role assignment is the actual authorization grant.

---

### Philosophy

> Authorization = Role + Role Assignment
> Roles define WHAT. Role assignments define WHERE.

A user may have zero, one, or many role assignments.

The effective permissions of a user are the union of all permissions granted by all applicable role assignments.

---

### Resource Hierarchy

```
Organization
└── Project
    └── Agent
        └── ChatSession
```

Future resources can be added without changing the authorization model.

---

### Global Rules

**Rule 1 — Role assignments apply downward**

A role assignment attached to a resource automatically applies to all descendant resources in the hierarchy.

Example: `Alice → project_admin → Project #42`

This assignment is considered when evaluating access to:

- Project #42
- Agent A (child of Project #42)
- Agent B (child of Project #42)
- Chat Session C (child of Agent A)

No additional role assignments are created on child resources.

**Rule 2 — Role assignments never apply upward**

An assignment attached to an Agent never grants access to the parent Project or Organization.

**Rule 3 — Every role is scoped**

Every role belongs to a specific scope type.

Examples:

- `org_admin` → `Organization`
- `project_admin` → `Project`
- `agent_viewer` → `Agent`

Constraint: `role.scope_type == role_assignment.resource_type`

**Rule 4 — Permissions never move**

Permissions always belong to roles.

What propagates through the hierarchy is the _applicability_ of a role assignment, not the permission itself.

**Rule 5 — Access is resolved dynamically**

Permissions are never copied to child resources.

Existing role assignments are reused during authorization checks.

---

### Data Model

```
roles
- id
- key
- name
- scope_type

permissions
- id
- key

role_permissions
- role_id
- permission_id

role_assignments
- user_id
- role_id
- resource_type
- resource_id
```

---

### Permission Resolution

When evaluating `can(user, permission, resource)`:

**Step 1** — Find all applicable role assignments on:

- The resource itself
- Parent resources
- Global scope

**Step 2** — Resolve roles and permissions from those assignments.

The user is authorized if at least one applicable role grants the requested permission.

---

### Multiple Roles Per User

A user may have multiple role assignments simultaneously.

Example:

```
Didier
- org_admin     → Organization #1
- project_admin → Project #42
- agent_viewer  → Agent #123
```

Permissions are additive. The effective permissions are the union of all permissions granted by all applicable role assignments.

---

### Examples

**Organization Member + Project Admin**

Alice:

- `org_member` → Organization #1
- `project_admin` → Project #42

Result:

- Limited rights in the organization
- Full administration rights in Project #42

**Consultant**

Bob:

- `project_viewer` → Project #10
- `project_viewer` → Project #25

Result:

- Access to Projects #10 and #25
- No access elsewhere

**Single Agent Access**

Bob:

- `agent_viewer` → Agent #123

Can access only Agent #123.
No access to the parent project or organization.

---

### What This Model Does NOT Support

- Negative permissions
- ABAC (attribute-based access control)
- Complex conditional authorization
- Automatic collection filtering
- Automatic sharing across unrelated resources

These concerns remain the responsibility of application policies.

---

### Guiding Principle

> Roles define WHAT.
> Role assignments define WHERE.
> Role assignments apply downward and never upward.
> Permissions never move.

---

---

## Part II — Implementation Spec

### Background: current authorization stack

The existing stack has four membership entities:

| Entity | Table (current) | Role type | Unique constraint |
|---|---|---|---|
| `OrganizationMembership` | `organization_memberships` | `owner \| admin \| member` | `(userId, organizationId)` |
| `ProjectMembership` | `project_memberships` | `owner \| admin \| member` | `(userId, projectId)` |
| `AgentMembership` | `agent_memberships` | `owner \| admin \| member` | `(userId, agentId)` |
| `ReviewCampaignMembership` | `review_campaign_memberships` | `tester \| reviewer` | `(userId, campaignId, role)` — a user can hold both roles simultaneously |

Each membership is loaded by a dedicated context resolver and placed on the request object. Policy classes (`BasePolicy`, `ProjectScopedPolicy`, domain policies) make direct role comparisons (`isProjectAdminOrOwner()`, etc.).

The guard/decorator/policy surface (`@UseGuards`, `@RequireContext`, `@AddContext`, `@CheckPolicy`) is clean and must be **preserved unchanged** throughout this migration.

---

### Delivery plan

| PR | Title | Risk |
|---|---|---|
| **PR 1** | Unify the four membership entities into `UserMembership` | Low — pure table consolidation, no logic change |
| **PR 2** | Add RBAC data model (`roles`, `permissions`, `role_permissions`, `role_assignments`) | Low — additive only, new tables |
| **PR 3** | `PermissionResolver` service + `RbacPermissionsContextResolver` | Medium — new logic, no API surface changes |
| **PR 4** | Documents pilot: wire to new permission system | Medium — first policy rewrite, legacy intact elsewhere |

---

### PR 1 — Unified membership entity

#### Motivation

The three role-compatible membership entities (`OrganizationMembership`, `ProjectMembership`, `AgentMembership`) are structurally identical. `ReviewCampaignMembership` differs only in its role vocabulary and its multi-role-per-user semantics.

Consolidating all four now:

- reduces the number of tables the RBAC migration must sunset
- enables a single `RbacPermissionsContextResolver` that reads one table
- is a safe, independently testable change with no authorization logic change

#### New entity: `UserMembership`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `user_id` | `uuid` | FK → `users.id`, NOT NULL | |
| `resource_type` | `enum` | NOT NULL | `'organization' \| 'project' \| 'agent' \| 'review_campaign'` |
| `resource_id` | `uuid` | NOT NULL | No FK constraint — cross-table FK would force a cascading delete strategy |
| `role` | `enum` | NOT NULL | `'owner' \| 'admin' \| 'member' \| 'tester' \| 'reviewer'` |
| `accepted_at` | `timestamptz` | nullable | Populated only for `review_campaign` rows (migrated from `ReviewCampaignMembership.acceptedAt`) |
| `created_at` | `timestamptz` | auto | |
| `updated_at` | `timestamptz` | auto | |

**Indexes and constraints:**

```sql
UNIQUE (user_id, resource_type, resource_id)
  -- enforces single-membership for org / project / agent rows
  -- for review_campaign rows this constraint is deliberately relaxed (see below)

INDEX (user_id, resource_type, resource_id)
INDEX (resource_type, resource_id)   -- listing all members of a resource
```

**Review Campaign carve-out**

`ReviewCampaignMembership` allows a user to hold _both_ `tester` and `reviewer` roles on the same campaign, which violates the unique constraint above. The implementation uses a partial unique index to enforce the stricter constraint only for non-campaign rows:

```sql
-- Enforce single-membership for org / project / agent
CREATE UNIQUE INDEX ux_user_memberships_non_campaign
  ON user_memberships (user_id, resource_type, resource_id)
  WHERE resource_type != 'review_campaign';

-- For review_campaign: a user can hold both roles, but not the same role twice
CREATE UNIQUE INDEX ux_user_memberships_campaign
  ON user_memberships (user_id, resource_type, resource_id, role)
  WHERE resource_type = 'review_campaign';
```

TypeORM exposes partial indexes via `@Index({ unique: true, where: "..." })`.

#### Migration strategy

1. Create the `user_memberships` table.
2. Migrate data from the four legacy tables:

```sql
-- OrganizationMembership
INSERT INTO user_memberships (id, user_id, resource_type, resource_id, role, created_at, updated_at)
SELECT id, user_id, 'organization', organization_id, role, created_at, updated_at
FROM organization_memberships;

-- ProjectMembership
INSERT INTO user_memberships (id, user_id, resource_type, resource_id, role, created_at, updated_at)
SELECT id, user_id, 'project', project_id, role, created_at, updated_at
FROM project_memberships;

-- AgentMembership
INSERT INTO user_memberships (id, user_id, resource_type, resource_id, role, created_at, updated_at)
SELECT id, user_id, 'agent', agent_id, role, created_at, updated_at
FROM agent_memberships;

-- ReviewCampaignMembership
INSERT INTO user_memberships (id, user_id, resource_type, resource_id, role, accepted_at, created_at, updated_at)
SELECT id, user_id, 'review_campaign', campaign_id, role, accepted_at, created_at, updated_at
FROM review_campaign_memberships;
```

3. Update the four context resolvers to read from `user_memberships` with a `resource_type` filter. The resolvers still populate the same request fields (`request.organizationMembership`, `request.projectMembership`, etc.) so that downstream policy classes are unaffected.
4. Keep the four legacy entity classes in place for this PR (no deletion). Their repositories continue to be used by write paths (membership creation, invitation acceptance) that are out of scope here.
5. A follow-up cleanup PR drops the four legacy tables and entities once all write paths are confirmed stable.

#### Impact on policies

**Zero.** Context resolvers present the same request-object shape as before. All `BasePolicy`, `ProjectScopedPolicy`, and domain policy classes are untouched.

#### Files touched

```
apps/api/src/
  common/
    entities/user-membership.entity.ts              ← new
    all-entities.ts                                  ← add UserMembership
    test/test-all-repositories.ts                    ← add userMembershipRepository
    test/test-database.ts                            ← add DELETE FROM user_memberships
  context/resolvers/
    organization-context.resolver.ts                 ← read from user_memberships
    project-context.resolver.ts                      ← read from user_memberships
    agent-context.resolver.ts                        ← read from user_memberships
    review-campaign-context.resolver.ts              ← read from user_memberships
  migrations/
    <timestamp>-unified-user-membership.ts           ← auto-generated
```

---

### PR 2 — RBAC data model

This PR is purely additive. No existing tables, entities, or logic is modified.

#### New tables

```
roles
─────────────────────────────────────────────────────────
id          uuid  PK
key         varchar  UNIQUE   e.g. "org_owner", "project_admin", "agent_viewer"
name        varchar
scope_type  enum('organization','project','agent','global')
created_at  timestamptz
updated_at  timestamptz

permissions
─────────────────────────────────────────────────────────
id          uuid  PK
key         varchar  UNIQUE   e.g. "document.list", "document.create"
created_at  timestamptz

role_permissions
─────────────────────────────────────────────────────────
role_id        uuid  FK → roles.id        ON DELETE CASCADE
permission_id  uuid  FK → permissions.id  ON DELETE CASCADE
PRIMARY KEY (role_id, permission_id)

role_assignments
─────────────────────────────────────────────────────────
id             uuid  PK
user_id        uuid  FK → users.id   ON DELETE CASCADE
role_id        uuid  FK → roles.id   ON DELETE CASCADE
resource_type  enum('organization','project','agent','global')
resource_id    uuid  nullable  (null = global scope)
created_at     timestamptz
updated_at     timestamptz

UNIQUE (user_id, role_id, resource_type, resource_id)
INDEX  (user_id, resource_type, resource_id)
INDEX  (resource_type, resource_id)
```

No FK constraint on `resource_id` (cross-table FK would complicate cascade deletes across resource types; application-level integrity is sufficient at this stage).

#### New TypeORM entities

```
apps/api/src/domains/rbac/
  role.entity.ts
  permission.entity.ts
  role-permission.entity.ts
  role-assignment.entity.ts
  rbac.module.ts
```

#### Seed data (document domain — pilot scope)

A deterministic seed migration populates the standard roles and the document-domain permissions.

**Roles and their document permissions:**

| Role key | Scope | `document.list` | `document.view` | `document.create` | `document.update` | `document.delete` | `document.download` |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| `org_owner` | organization | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `org_admin` | organization | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `org_member` | organization | | ✓ | | | | ✓ (public only) |
| `project_admin` | project | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `project_member` | project | | ✓ | ✓ ¹ | | | ✓ (public only) |
| `project_viewer` | project | | ✓ | | | | |
| `agent_editor` | agent | | ✓ | | | | |
| `agent_viewer` | agent | | ✓ | | | | |

¹ `project_member` retains `document.create` for `agentSessionMessage` and `extraction` source types, preserving the current legacy behaviour. The policy (not the permission set) enforces the source type restriction — see PR 4.

#### Mapping existing memberships to role assignments

A data migration (run as part of the PR 4 deployment) converts every `user_memberships` row to a `role_assignments` row:

| `resource_type` | `role` | → `role_key` |
|---|---|---|
| `organization` | `owner` | `org_owner` |
| `organization` | `admin` | `org_admin` |
| `organization` | `member` | `org_member` |
| `project` | `owner` | `project_admin` |
| `project` | `admin` | `project_admin` |
| `project` | `member` | `project_member` |
| `agent` | `owner` | `agent_editor` |
| `agent` | `admin` | `agent_editor` |
| `agent` | `member` | `agent_editor` |
| `review_campaign` | `tester` | _(no document permissions — out of pilot scope)_ |
| `review_campaign` | `reviewer` | _(no document permissions — out of pilot scope)_ |

Note: existing project `owner` rows become `project_admin`. There is no distinct `project_owner` role — owners and admins receive the same permissions. The original creator distinction, if needed in the future, can be tracked via a separate field on the project entity.

---

### PR 3 — Permission resolution service + RBAC context resolver

#### `PermissionResolver` service

```
apps/api/src/domains/rbac/permission-resolver.service.ts
```

```typescript
type ResourceRef = { type: ResourceType; id: string }

class PermissionResolver {
  async resolvePermissions(
    userId: string,
    resource: ResourceRef,
    ancestors: ResourceRef[],  // ordered nearest → furthest: e.g. [project, organization]
  ): Promise<Set<string>>
}
```

**Algorithm:**

1. Build the lookup set: `[resource, ...ancestors]` plus any `global` assignments.
2. Execute a single SQL query joining `role_assignments`, `role_permissions`, and `permissions` with an IN clause across all resource refs.
3. Return the result as `Set<string>`.

The ancestor list is provided by the caller (the context resolver), keeping the service pure and independently testable. No N+1 queries.

#### `RbacPermissionsContextResolver`

```
apps/api/src/common/context/resolvers/rbac-permissions-context.resolver.ts
```

- Registered as context key `"rbacPermissions"`.
- Reads `request.project` (already resolved by `ProjectContextResolver`) to build the ancestor chain for project-scoped resources: `project → organization`.
- Calls `PermissionResolver.resolvePermissions(userId, resource, ancestors)`.
- Writes `request.rbacPermissions: Set<string>`.
- Runs **after** `ProjectContextResolver` in `RESOLUTION_ORDER`.

#### `RbacModule`

```
apps/api/src/domains/rbac/rbac.module.ts
```

Exports `PermissionResolver` and `RbacPermissionsContextResolver`. Feature modules that adopt the new system import `RbacModule`.

---

### PR 4 — Documents pilot

Only the documents domain is modified. All other domains continue to use the legacy membership-based system.

#### Files touched

| File | Change |
|---|---|
| `documents.module.ts` | Import `RbacModule` |
| `documents.controller.ts` | Add `"rbacPermissions"` to `@RequireContext` |
| `documents.guard.ts` | Construct `DocumentPolicy` from `request.rbacPermissions` |
| `document.policy.ts` | Rewrite as a flat, permission-set-based class |

#### `documents.controller.ts`

```diff
-@RequireContext("organization", "project")
+@RequireContext("organization", "project", "rbacPermissions")
```

Nothing else in the controller changes. All `@CheckPolicy((policy) => policy.canXxx())` decorators remain identical.

#### `documents.guard.ts`

```diff
-const policy = new DocumentPolicy(
-  { organizationMembership, projectMembership, project },
-  document,
-)
+const policy = new DocumentPolicy(request.rbacPermissions, document)
```

#### `document.policy.ts`

Replace the `ProjectScopedPolicy<Document>` inheritance with a flat class:

```typescript
export class DocumentPolicy {
  constructor(
    private readonly permissions: Set<string>,
    private readonly entity?: Document,
  ) {}

  canList(): boolean {
    return this.permissions.has("document.list")
  }

  canView(): boolean {
    return this.permissions.has("document.view")
  }

  canCreate(): boolean {
    if (this.sourceType && ["agentSessionMessage", "extraction"].includes(this.sourceType)) {
      // project_member can create these source types — they have document.create
      return this.permissions.has("document.create")
    }
    // For manually-created documents, require document.list as proxy for admin/owner
    return this.permissions.has("document.list")
  }

  canUpdate(): boolean {
    return this.permissions.has("document.update")
  }

  canDelete(): boolean {
    return this.permissions.has("document.delete")
  }

  /**
   * Admins/owners have document.list — they can download any document.
   * Members only have document.download — restricted to public documents.
   */
  canDownload(): boolean {
    if (!this.permissions.has("document.download")) return false
    if (this.permissions.has("document.list")) return true
    return this.entity ? isPublicDocument(this.entity) : false
  }
}
```

`document.list` acts as a proxy for admin/owner status in `canCreate` and `canDownload`. Both behaviours preserve the existing access semantics exactly.

#### Data migration (runs in this PR's deployment)

Convert all `user_memberships` rows to `role_assignments` using the mapping table from PR 2. This ensures every user's existing access is preserved from day one of the pilot.

No dual-write is introduced at this stage. Write paths still write only to `user_memberships`. A follow-up PR adds dual-write once the pilot is validated in production.

#### E2E test updates

Existing `documents/e2e-tests/auth.spec.ts` continues to pass without structural changes because:

- Test factories create `user_memberships` rows (via `createOrganizationWithProject` and friends).
- The data migration logic is extracted into a helper and called in the test database setup to also populate `role_assignments` for the test data.
- `@CheckPolicy` decorators and HTTP response codes are unchanged.

---

### Coexistence matrix

| Concern | Legacy system (all domains except Documents) | New system (Documents pilot) |
|---|---|---|
| Source of truth | `user_memberships` | `role_assignments` |
| Context resolved onto request | `organizationMembership`, `projectMembership`, … | `rbacPermissions: Set<string>` |
| Policy base class | `ProjectScopedPolicy` / `BasePolicy` | flat `DocumentPolicy` |
| Authorization logic | role comparisons (`isProjectAdminOrOwner()`) | permission set check (`permissions.has(…)`) |
| Guard reads from | `request.projectMembership` | `request.rbacPermissions` |
| Controller decorator changes | none | `@RequireContext` gains `"rbacPermissions"` |
| `@CheckPolicy` decorators | unchanged | unchanged |

---

### Explicitly out of scope

- Back-office UI for managing roles and permissions
- Dual-write on membership creation / invitation acceptance (follow-up PR after pilot validation)
- Permission resolution for `ReviewCampaignMembership` (`tester`/`reviewer` rows are unified in PR 1 but not yet mapped to RBAC seed data)
- Automatic collection filtering based on role assignments
- Agent-level and organization-level resource-specific permissions (pilot targets only project-scoped Documents)

---

### Decisions made

| # | Question | Decision |
|---|---|---|
| 1 | Should `project_member` be able to create `agentSessionMessage` / `extraction` source documents? | Yes — preserve the current legacy behaviour |
| 2 | Distinct `project_owner` role, or merge `owner` → `project_admin`? | Merge — existing project owners become `project_admin` |
| 3 | Keep `document.list` proxy for full-download access, or add `document.download.all`? | Keep the proxy for now |
| 4 | `ReviewCampaignMembership.acceptedAt` — nullable column on `user_memberships` or separate detail table? | Nullable column on `user_memberships` |
| 5 | Drop legacy membership tables within PR 1, or in a dedicated cleanup PR? | Dedicated cleanup PR after resolvers are confirmed stable |
