# RBAC Permission Matrix

Source of truth in code:

- Roles and grants: `apps/api/src/domains/rbac/rbac.constants.ts`
- Global permission contract (exposed on `/me`): `packages/api-contracts/src/rbac/permissions.ts`

This document mirrors those files. Whenever a role or a role/permission grant changes, update the matching table here in the same PR (see `.cursor/rules/permission-matrix.mdc` and the `check-permission-matrix` Claude skill).

## Global roles

Global roles are stored as `user_membership` rows with `resource_type = 'global'`. `platform_staff` is renamed from `org_creator` and seeded by email domain (`SeedPlatformStaffByEmailDomain` / `ORGANIZATION_CREATOR_EMAIL_DOMAIN`). `platform_superadmin` is seeded from `BACKOFFICE_AUTHORIZED_EMAILS` by `SeedPlatformSuperadminByEmails`. The app itself never reads those env vars for authorization.

| Permission | `platform_staff` | `platform_superadmin` |
|---|---|---|
| `backoffice.read` — access `/backoffice` routes | ✅ | ✅ |
| `trace.read` — see Langfuse trace links | ✅ | ✅ |
| `backoffice.terms.update` — manage terms documents | — | ✅ |
| `backoffice.organization.read` — see every organization in the backoffice | — | ✅ |
| `backoffice.project.read` — see every project in the backoffice | — | ✅ |
| `backoffice.project.update` — mutate projects from the backoffice (e.g. feature flags) | — | ✅ |
| `backoffice.agent.read` — see every agent in the backoffice | — | ✅ |
| `backoffice.user.read` — see every user in the backoffice | — | ✅ |
| `organization.create` — create organizations | — | ✅ |

## Organization roles

Scoped to one organization via `user_membership` (`resource_type = 'organization'`). Org roles deliberately do not grant `project.read`: project visibility is governed by project memberships only. They do grant `backoffice.project.read` / `backoffice.agent.read` so org admins see those resources in the backoffice via inheritance. They do **not** grant `backoffice.project.update` — feature-flag writes stay on project memberships.

| Permission | `org_owner` | `org_admin` | `org_member` |
|---|---|---|---|
| `organization.read` | ✅ | ✅ | ✅ |
| `organization.update` | ✅ | ✅ | — |
| `organization.delete` | ✅ | — | — |
| `project.create` | ✅ | ✅ | — |
| `user.read` — see the organization's members | ✅ | ✅ | — |
| `backoffice.organization.read` — see the organization in the backoffice | ✅ | ✅ | — |
| `backoffice.project.read` — see the organization's projects in the backoffice | ✅ | ✅ | — |
| `backoffice.agent.read` — see the organization's agents in the backoffice | ✅ | ✅ | — |

## Project roles

Scoped to one project via `user_membership` (`resource_type = 'project'`).

| Permission | `project_owner` | `project_admin` | `project_member` |
|---|---|---|---|
| `project.read` | ✅ | ✅ | ✅ |
| `project.update` | ✅ | ✅ | — |
| `project.delete` | ✅ | ✅ | — |
| `agent.create` | ✅ | ✅ | — |
| `agent.read` | ✅ | ✅ | — |
| `user.read` — see the project's members | ✅ | ✅ | — |
| `backoffice.project.read` — see the project in the backoffice | ✅ | ✅ | — |
| `backoffice.project.update` — mutate the project from the backoffice (e.g. feature flags) | ✅ | ✅ | — |
| `backoffice.agent.read` — see the project's agents in the backoffice | ✅ | ✅ | — |

## Agent roles

Scoped to one agent via `user_membership` (`resource_type = 'agent'`).

| Permission | `agent_owner` | `agent_admin` | `agent_member` |
|---|---|---|---|
| `agent.read` | ✅ | ✅ | ✅ |
| `agent.update` | ✅ | ✅ | — |
| `agent.delete` | ✅ | ✅ | — |
| `user.read` — see the agent's members | ✅ | ✅ | — |
| `backoffice.agent.read` — see the agent in the backoffice | ✅ | ✅ | — |
