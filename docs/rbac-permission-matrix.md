# RBAC Permission Matrix

Source of truth in code:

- Permission strings: `packages/api-contracts/src/rbac/permissions.ts`. This is the only declaration. The API imports them.
- Roles and grants: `apps/api/src/domains/rbac/rbac.constants.ts`. Role keys and which role receives which permission. It does not redeclare the strings.

This document mirrors those files. Whenever a role or a role/permission grant changes, update the matching table here in the same PR (see `.cursor/rules/permission-matrix.mdc` and the `check-permission-matrix` Claude skill).

## Global roles

Global roles are stored as `user_membership` rows with `resource_type = 'global'`. `platform_staff` is renamed from `org_creator` and seeded by email domain (`SeedPlatformStaffByEmailDomain` / `ORGANIZATION_CREATOR_EMAIL_DOMAIN`). `platform_superadmin` is seeded from `BACKOFFICE_AUTHORIZED_EMAILS` by `SeedPlatformSuperadminByEmails`. The app itself never reads those env vars for authorization. `platform_staff` holds global `backoffice.project.read` so the App install picker is not empty for the people who hold `app.install`. `backoffice.app.manage` is superadmin-only and is not granted by `app.install`.

| Permission | `platform_staff` | `platform_superadmin` |
|---|---|---|
| `app.install` — install apps on a project | ✅ | ✅ |
| `backoffice.app.manage` — manage app definitions in the backoffice | — | ✅ |
| `backoffice.read` — access `/backoffice` routes | ✅ | ✅ |
| `trace.read` — see trace links | ✅ | ✅ |
| `backoffice.terms.update` — manage terms documents | — | ✅ |
| `backoffice.organization.read` — see every organization in the backoffice | — | ✅ |
| `backoffice.project.read` — see every project in the backoffice | ✅ | ✅ |
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

The evaluation permissions are never inherited from the organization: an organization role does not open a project's evaluation app, its datasets or its runs.

`project.member.invite` is not inherited either: an organization role does not let anyone invite to a project.

| Permission | `project_owner` | `project_admin` | `project_member` |
|---|---|---|---|
| `project.read` | ✅ | ✅ | ✅ |
| `project.update` | ✅ | ✅ | — |
| `project.delete` | ✅ | ✅ | — |
| `project.analytics.read` — see the project's conversation analytics | ✅ | ✅ | — |
| `project.member.invite` — invite people to the project or its review campaigns, see and revoke pending invitations | ✅ | ✅ | — |
| `agent.create` | ✅ | ✅ | — |
| `agent.read` | ✅ | ✅ | — |
| `document.read` | ✅ | ✅ | — |
| `document.create` | ✅ | ✅ | — |
| `document.update` | ✅ | ✅ | — |
| `document.delete` | ✅ | ✅ | — |
| `document_source.read` | ✅ | ✅ | — |
| `document_source.create` | ✅ | ✅ | — |
| `document_source.update` | ✅ | ✅ | — |
| `document_source.delete` | ✅ | ✅ | — |
| `evaluation.access` — open the project's evaluation app | ✅ | ✅ | — |
| `evaluation.extraction.dataset.read` — see the project's evaluation extraction datasets and their files | ✅ | ✅ | — |
| `evaluation.extraction.dataset.create` — create evaluation extraction datasets and upload their files | ✅ | ✅ | — |
| `evaluation.extraction.dataset.update` — update an evaluation extraction dataset | ✅ | ✅ | — |
| `evaluation.extraction.dataset.delete` — delete an evaluation extraction dataset or one of its files | ✅ | ✅ | — |
| `evaluation.extraction.run.read` — see the project's evaluation extraction runs and their results | ✅ | ✅ | — |
| `evaluation.extraction.run.create` — create an evaluation extraction run | ✅ | ✅ | — |
| `evaluation.extraction.run.update` — execute, retry or cancel an evaluation extraction run | ✅ | ✅ | — |
| `evaluation.extraction.run.delete` — delete an evaluation extraction run | ✅ | ✅ | — |
| `evaluation.conversation.dataset.read` — see the project's evaluation conversation datasets and their records | ✅ | ✅ | — |
| `evaluation.conversation.dataset.create` — create an evaluation conversation dataset | ✅ | ✅ | — |
| `evaluation.conversation.dataset.update` — rename an evaluation conversation dataset or edit its records | ✅ | ✅ | — |
| `evaluation.conversation.dataset.delete` — delete an evaluation conversation dataset | ✅ | ✅ | — |
| `evaluation.conversation.run.read` — see the project's evaluation conversation runs and their results | ✅ | ✅ | — |
| `evaluation.conversation.run.create` — create an evaluation conversation run | ✅ | ✅ | — |
| `evaluation.conversation.run.update` — execute, retry or cancel an evaluation conversation run | ✅ | ✅ | — |
| `evaluation.conversation.run.delete` — delete an evaluation conversation run | ✅ | ✅ | — |
| `user.read` — see the project's members | ✅ | ✅ | — |
| `backoffice.project.read` — see the project in the backoffice | ✅ | ✅ | — |
| `backoffice.project.update` — mutate the project from the backoffice (e.g. feature flags) | ✅ | ✅ | — |
| `backoffice.agent.read` — see the project's agents in the backoffice | ✅ | ✅ | — |

## Agent roles

Scoped to one agent via `user_membership` (`resource_type = 'agent'`).

The two analytics permissions are never inherited from a parent resource: an organization role does not open a project's analytics, and a project role does not open an agent's analytics.

`agent.member.invite` is held on the agent only: a project or organization role does not let anyone invite to an agent.

| Permission | `agent_owner` | `agent_admin` | `agent_member` |
|---|---|---|---|
| `agent.read` | ✅ | ✅ | ✅ |
| `agent.update` | ✅ | ✅ | — |
| `agent.delete` | ✅ | ✅ | — |
| `agent.analytics.read` — see the agent's conversation analytics | ✅ | ✅ | — |
| `agent.member.invite` — invite people to the agent, see and revoke pending invitations | ✅ | ✅ | — |
| `user.read` — see the agent's members | ✅ | ✅ | — |
| `backoffice.agent.read` — see the agent in the backoffice | ✅ | ✅ | — |

## App grantable permissions

Apps may only be granted the permissions in `APP_GRANTABLE_PERMISSIONS`, grouped by resource type: document (`document.read`, `document.create`, `document.update`, `document.delete`), document source (`document_source.read`, `document_source.create`, `document_source.update`, `document_source.delete`), and workspace (`project.read`, `project.update`, `project.delete`). `project.create` is not grantable. This allowlist is code, not a database column. Manifest save and authorize intersect requested permissions with it.
