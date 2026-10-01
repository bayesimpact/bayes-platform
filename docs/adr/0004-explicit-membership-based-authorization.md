# ADR 0004: Explicit Membership-Based Authorization

* **Status**: Accepted (rights model superseded by [ADR 0019](0019-rbac-permission-catalog.md))
* **Date**: 2026-03-23 (updated 2026-03-31)
* **Deciders**: Jérémie

---

## 1. Context and Problem Statement

The platform needs a clear, minimal rights model that supports five distinct user profiles — from super-admin down to anonymous public access. Permissions must be **explicit** (materialized as rows), with **no implicit inheritance** at read time.

## 2. Decision

### 2.1 Roles Overview (v0)

| Role | Scope | Description |
|------|-------|-------------|
| Organization owner | Organization | Super admin of the organization |
| Organization admin | Organization | Can create workspaces |
| Workspace admin | Workspace | Manages workspace content and members |
| Agent user | Agent | End-user invited to use specific agents |
| Anonymous user | Agent | Public access via shared URL |

### 2.2 Permissions Matrix

#### Organization Owner (super admin)

- Can invite workspace creators (organization admins)
- Can list workspace creators
- Is a workspace creator themselves by default

#### Organization Admin

- Can create workspaces
- Becomes workspace admin of workspaces they create

#### Workspace Admin

- Can CRUD documents in their workspace
- Can CRUD agents in their workspace
- Can invite users to an agent
- Can invite other admins to their workspace
- Can enable anonymous access on an agent

#### Agent User

- Can use an agent they are invited to
- Can be invited to multiple agents (across workspaces)
- Does not need to know about organizations or workspaces — only sees a list of agents they have access to

#### Anonymous User

- Can use an agent that has anonymous access enabled
- Accesses the agent through a unique shared URL
- No authentication required

### 2.3 Three Membership Tables

| Table | Scope | Role enum |
|---|---|---|
| `OrganizationMembership` | Organization | `owner \| admin` |
| `WorkspaceMembership` | Workspace | `admin` |
| `AgentMembership` | Agent | `user` |

Each table stores one row per user-resource pair. A user's access to a given resource is determined **solely** by the existence and role of their row in the corresponding table.

Anonymous access is not modeled as a membership — it is a boolean flag on the agent entity itself.

### 2.4 No Implicit Rights

Authorization checks at any level look **only** at the corresponding membership table. There is no cascading logic such as "if the user is an org owner, they can access all workspaces". If a membership row does not exist, access is denied.

This makes the system:

- **Auditable** — a single SQL query on the membership table answers "who has access to what?"
- **Predictable** — no hidden permission inheritance to debug.
- **Performant** — no joins or recursive checks across multiple tables at read time.

### 2.5 Explicit Right Propagation Rules

Because rights are not implicit, the application code must **explicitly create membership rows** when certain events occur:

1. **Organization owner invites an organization admin** — No automatic propagation. The admin can create workspaces but has no access to existing ones unless explicitly invited.

2. **Organization admin creates a workspace** — The system automatically creates a `WorkspaceMembership` row with role `admin` for that user.

3. **Workspace admin creates an agent** — No automatic agent membership is needed; the workspace admin already has full control over agents in their workspace via workspace-level checks.

4. **Workspace admin invites a user to an agent** — The system creates an `AgentMembership` row with role `user`.

5. **Workspace admin enables anonymous access on an agent** — The system sets a flag on the agent entity and generates a shared URL.

### 2.6 Agent User Experience

Agent users have a simplified view of the platform:

- They see only the agents they are invited to.
- Organization and workspace context may be visible as informational labels but do not affect their navigation or access.
- If invited to multiple agents, they see a list/selector of available agents.

## 3. Alternatives Considered

* **Implicit role inheritance** (e.g., org owner automatically has access to all child resources at query time): Rejected because it creates hidden coupling, makes auditing difficult, and requires complex authorization logic at every access point.
* **Single membership table with a polymorphic `resource_type` column**: Rejected because it prevents proper foreign key constraints and makes queries less efficient.
* **RBAC with a separate permissions table**: Over-engineered for our current needs. The role model on each table is sufficient and avoids the complexity of a full permission matrix.

## 4. Consequences

* **Positive Impacts**:
    * **Auditability**: A simple query on any membership table shows exactly who has access and at what level.
    * **Simplicity**: Authorization guards only need to check one table — no recursive role resolution.
    * **Correctness**: No risk of permission leaks through implicit inheritance bugs.
    * **Clear UX boundary**: Agent users have a minimal, focused experience.
* **Negative Impacts / Risks**:
    * **Write-time complexity**: Event handlers must correctly propagate memberships. If a propagation fails or is missed, a user could lose access. Must be covered by transactional guarantees and tests.
    * **Migration effort**: The existing tables must be migrated to the new schema (rename `Project` to `Workspace`, update role enums).

## 5. Implementation Notes

* Rename `Project` references to `Workspace` across entities, tables, and API contracts.
* Update `OrganizationMembership` role enum to `owner | admin`.
* `WorkspaceMembership` has a single role: `admin`.
* `AgentMembership` has a single role: `user`.
* Anonymous access is a boolean `isAnonymousAccessEnabled` flag + a `anonymousAccessSlug` on the `Agent` entity.
* Agent user UI: build an agent selector that queries `AgentMembership` for the current user, without requiring workspace/org navigation.