# RBAC Permission Matrix

Source of truth in code:

- Permission strings: `packages/api-contracts/src/rbac/permissions.ts`. This is the only declaration. The API imports them.
- Roles and grants: `apps/api/src/domains/rbac/rbac.constants.ts`. Role keys and which role receives which permission. It does not redeclare the strings.

This document mirrors those files. Whenever a role or a role/permission grant changes, update the matching table here in the same PR (see `.cursor/rules/permission-matrix.mdc` and the `check-permission-matrix` Claude skill).

## Global roles

Global roles are stored as `user_membership` rows with `resource_type = 'global'`. `platform_staff` is renamed from `org_creator` and seeded by email domain (`SeedPlatformStaffByEmailDomain` / `ORGANIZATION_CREATOR_EMAIL_DOMAIN`). `platform_superadmin` is seeded from `BACKOFFICE_AUTHORIZED_EMAILS` by `SeedPlatformSuperadminByEmails`. The app itself never reads those env vars for authorization. `platform_staff` holds global `backoffice.project.read` so the App install picker is not empty for the people who hold `app.install`. `backoffice.app.manage` is superadmin-only and is not granted by `app.install`. `conversation_reviewer` is held by nobody by default: a holder of `backoffice.user.role.update` (superadmin) grants it person by person from the backoffice user page, and the superadmin role itself does not hold `agent.conversation.review`. Reading a conversation still needs a membership of its organization.

| Permission | `platform_staff` | `platform_superadmin` | `conversation_reviewer` |
|---|---|---|---|
| `app.install` — install apps on a project | ✅ | ✅ | — |
| `backoffice.app.manage` — manage app definitions in the backoffice | — | ✅ | — |
| `backoffice.read` — access `/backoffice` routes | ✅ | ✅ | — |
| `trace.read` — see trace links | ✅ | ✅ | — |
| `backoffice.terms.update` — manage terms documents | — | ✅ | — |
| `backoffice.organization.read` — see every organization in the backoffice | — | ✅ | — |
| `backoffice.project.read` — see every project in the backoffice | ✅ | ✅ | — |
| `backoffice.project.update` — mutate projects from the backoffice (e.g. feature flags) | — | ✅ | — |
| `backoffice.agent.read` — see every agent in the backoffice | — | ✅ | — |
| `backoffice.user.read` — see every user in the backoffice | — | ✅ | — |
| `organization.create` — create organizations | — | ✅ | — |
| `backoffice.user.role.update` — grant or revoke the conversation reviewer role from the backoffice | — | ✅ | — |
| `agent.conversation.review` — read any conversation of an agent from its session id (safety review) | — | — | ✅ |

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

The `project.member.*` permissions are not inherited either: an organization role does not let anyone see a project's members, invite to a project, change a member's role or remove a member.

The `resource_library.*` permissions are not inherited either: an organization role does not open a project's resource libraries.

The `*.ui.read` permissions open one user interface of the project each and are not inherited from the organization. They are exposed on `ProjectDto.permissions`.

The `csv_extraction_run.*` permissions are not inherited either: an organization role does not open a project's CSV extraction runs. Every project role holds the four live run permissions, while the `csv_extraction_run.playground.*` ones stay with owners and admins.

The `agent.conversation.session.*` permissions are not inherited either: an organization role does not open a project's conversations. Every project role holds the three live session permissions, while the `agent.conversation.session.playground.*` ones stay with owners and admins. Each caller only ever sees their own sessions.

The `agent.extraction.session.*` permissions follow the same rule: an organization role does not open a project's extraction runs. Every project role holds the three live session permissions, while the `agent.extraction.session.playground.*` ones stay with owners and admins. Each caller only ever sees their own runs and the documents they uploaded for them.

The `project.agent_session_category.*` permissions are not inherited either: an organization role does not change a project's conversation categories.

The `project.agent_message_feedback.*` permissions are not inherited either: an organization role does not open a project's message feedback. Every project role can leave feedback, while reading it stays with owners and admins.

The `document_tag.*` permissions are not inherited either: an organization role does not open a project's document tags. Reading and changing them stays with project owners and admins.

The `project.mcp_server.*` permissions are not inherited either: an organization role does not open a project's MCP servers. Every project role sees them, while adding, connecting, toggling and deleting stay with owners and admins.

The `project.review_campaign.*` permissions are not inherited either: an organization role does not open a project's review campaigns. Managing them, inviting testers and reviewers and removing them stays with project owners and admins.

| Permission | `project_owner` | `project_admin` | `project_member` |
|---|---|---|---|
| `project.read` | ✅ | ✅ | ✅ |
| `project.update` | ✅ | ✅ | — |
| `project.delete` | ✅ | ✅ | — |
| `desk.ui.read` — open the project's desk app | ✅ | ✅ | ✅ |
| `studio.ui.read` — open the project's studio app | ✅ | ✅ | — |
| `evaluation.ui.read` — open the project's evaluation app | ✅ | ✅ | — |
| `project.analytics.read` — see the project's conversation analytics | ✅ | ✅ | — |
| `project.member.read` — see the project's members, their roles and the agents each one can reach | ✅ | ✅ | — |
| `project.member.invite` — invite people to the project, see and revoke pending invitations | ✅ | ✅ | — |
| `project.member.update` — change another member's role between admin and member | ✅ | ✅ | — |
| `project.member.delete` — remove a member from the project | ✅ | ✅ | — |
| `agent.create` | ✅ | ✅ | — |
| `agent.read` | ✅ | ✅ | — |
| `agent.draft.read` — list the project's agents with their draft settings | ✅ | ✅ | — |
| `agent.settings.draft.read` — see the revision history of an agent's settings, drafts included | ✅ | ✅ | — |
| `document.read` | ✅ | ✅ | — |
| `document.create` | ✅ | ✅ | — |
| `document.update` | ✅ | ✅ | — |
| `document.delete` | ✅ | ✅ | — |
| `document_source.read` | ✅ | ✅ | — |
| `document_source.create` | ✅ | ✅ | — |
| `document_source.update` | ✅ | ✅ | — |
| `document_source.delete` | ✅ | ✅ | — |
| `document_tag.read` — see document tags in the project | ✅ | ✅ | — |
| `document_tag.create` — create a document tag | ✅ | ✅ | — |
| `document_tag.update` — update a document tag | ✅ | ✅ | — |
| `document_tag.delete` — delete a document tag | ✅ | ✅ | — |
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
| `resource_library.read` — see the project's resource libraries | ✅ | ✅ | — |
| `resource_library.create` — create a resource library, or upload a file for one of its resources | ✅ | ✅ | — |
| `resource_library.update` — rename a resource library, or add, edit and remove its resources | ✅ | ✅ | — |
| `resource_library.delete` — delete a resource library | ✅ | ✅ | — |
| `csv_extraction_run.read` — see the agents' live CSV extraction runs and their results | ✅ | ✅ | ✅ |
| `csv_extraction_run.create` — create a live CSV extraction run | ✅ | ✅ | ✅ |
| `csv_extraction_run.update` — execute, retry or cancel a live CSV extraction run | ✅ | ✅ | ✅ |
| `csv_extraction_run.delete` — delete a live CSV extraction run | ✅ | ✅ | ✅ |
| `csv_extraction_run.playground.read` — see the agents' playground CSV extraction runs and their results | ✅ | ✅ | — |
| `csv_extraction_run.playground.create` — create a playground CSV extraction run | ✅ | ✅ | — |
| `csv_extraction_run.playground.update` — execute, retry or cancel a playground CSV extraction run | ✅ | ✅ | — |
| `csv_extraction_run.playground.delete` — delete a playground CSV extraction run | ✅ | ✅ | — |
| `agent.conversation.session.read` — see your live conversations with the project's agents, and their sub-sessions | ✅ | ✅ | ✅ |
| `agent.conversation.session.create` — start a live conversation with an agent | ✅ | ✅ | ✅ |
| `agent.conversation.session.delete` — delete one of your live conversations | ✅ | ✅ | ✅ |
| `agent.conversation.session.playground.read` — see your playground conversations with the project's agents, and their sub-sessions | ✅ | ✅ | — |
| `agent.conversation.session.playground.create` — start a playground conversation with an agent | ✅ | ✅ | — |
| `agent.conversation.session.playground.delete` — delete one of your playground conversations | ✅ | ✅ | — |
| `agent.extraction.session.read` — see your live extraction runs with the project's agents, and the documents you uploaded for them | ✅ | ✅ | ✅ |
| `agent.extraction.session.create` — upload a document and run a live extraction with an agent | ✅ | ✅ | ✅ |
| `agent.extraction.session.delete` — delete one of your live extraction runs | ✅ | ✅ | ✅ |
| `agent.extraction.session.playground.read` — see your playground extraction runs with the project's agents, and the documents you uploaded for them | ✅ | ✅ | — |
| `agent.extraction.session.playground.create` — upload a document and run a playground extraction with an agent | ✅ | ✅ | — |
| `agent.extraction.session.playground.delete` — delete one of your playground extraction runs | ✅ | ✅ | — |
| `project.agent_session_category.create` — create a conversation category in the project, optionally assigned to every conversational agent | ✅ | ✅ | — |
| `project.agent_session_category.delete` — delete a conversation category from the project | ✅ | ✅ | — |
| `project.agent_message_feedback.read` — see the feedback people left on an agent's messages | ✅ | ✅ | — |
| `project.agent_message_feedback.create` — leave feedback on an agent's message | ✅ | ✅ | ✅ |
| `project.mcp_server.read` — see the project's MCP servers | ✅ | ✅ | ✅ |
| `project.mcp_server.create` — add an MCP server to the project | ✅ | ✅ | — |
| `project.mcp_server.update` — turn an MCP server on or off for an agent, or connect it through OAuth | ✅ | ✅ | — |
| `project.mcp_server.delete` — delete an MCP server from the project | ✅ | ✅ | — |
| `project.review_campaign.read` — see the project's review campaigns | ✅ | ✅ | — |
| `project.review_campaign.create` — create a review campaign | ✅ | ✅ | — |
| `project.review_campaign.update` — update a review campaign | ✅ | ✅ | — |
| `project.review_campaign.delete` — delete a review campaign | ✅ | ✅ | — |
| `project.review_campaign.member.delete` — remove a tester or a reviewer from a review campaign | ✅ | ✅ | — |
| `project.review_campaign.member.invite` — invite testers and reviewers to a review campaign, see and revoke pending invitations | ✅ | ✅ | — |
| `user.read` — see the project's members | ✅ | ✅ | — |
| `backoffice.project.read` — see the project in the backoffice | ✅ | ✅ | — |
| `backoffice.project.update` — mutate the project from the backoffice (e.g. feature flags) | ✅ | ✅ | — |
| `backoffice.agent.read` — see the project's agents in the backoffice | ✅ | ✅ | — |

## Agent roles

Scoped to one agent via `user_membership` (`resource_type = 'agent'`).

The two analytics permissions are never inherited from a parent resource: an organization role does not open a project's analytics, and a project role does not open an agent's analytics.

The `agent.member.*` permissions are held on the agent only: a project or organization role does not let anyone see an agent's members, invite to an agent or remove a member.

`agent.sub_agent.read` and `agent.sub_agent.update` are held on the agent only as well: a project or organization role does not open an agent's sub-agents.

The same goes for `agent.settings.draft.update`, `agent.settings.draft.publish`, `agent.settings.restore` and `agent.settings.archive`: only an agent role lets someone change an agent's settings.

`agent.settings.draft.read` works the other way: it is checked on the agent but granted on project owners and admins, and passes down to every agent of the project.

| Permission | `agent_owner` | `agent_admin` | `agent_member` |
|---|---|---|---|
| `agent.read` | ✅ | ✅ | ✅ |
| `agent.update` | ✅ | ✅ | — |
| `agent.delete` | ✅ | ✅ | — |
| `agent.analytics.read` — see the agent's conversation analytics | ✅ | ✅ | — |
| `agent.member.read` — see the agent's members and their roles | ✅ | ✅ | — |
| `agent.member.invite` — invite people to the agent, see and revoke pending invitations | ✅ | ✅ | — |
| `agent.member.delete` — remove a member from the agent | ✅ | ✅ | — |
| `agent.sub_agent.read` — see the sub-agents the agent can call | ✅ | ✅ | — |
| `agent.sub_agent.update` — replace the sub-agents the agent can call | ✅ | ✅ | — |
| `agent.settings.draft.update` — edit the draft settings | ✅ | ✅ | — |
| `agent.settings.draft.publish` — publish the draft settings as a new revision | ✅ | ✅ | — |
| `agent.settings.restore` — restore an older revision of the settings into the draft | ✅ | ✅ | — |
| `agent.settings.archive` — archive a revision of the settings | ✅ | ✅ | — |
| `user.read` — see the agent's members | ✅ | ✅ | — |
| `backoffice.agent.read` — see the agent in the backoffice | ✅ | ✅ | — |

## App grantable permissions

Apps may only be granted the permissions in `APP_GRANTABLE_PERMISSIONS`, grouped by resource type: document (`document.read`, `document.create`, `document.update`, `document.delete`), document source (`document_source.read`, `document_source.create`, `document_source.update`, `document_source.delete`), document tag (`document_tag.read`, `document_tag.create`, `document_tag.update`, `document_tag.delete`), workspace (`project.read`, `project.update`, `project.delete`), and agent (`agent.read`, `agent.conversation.session.external.create`). `project.create` is not grantable. `agent.conversation.session.external.create` lets an App open conversations with the agents of its project for people outside the platform: no catalog role grants it, and the install role passes it down from the project to its agents. This allowlist is code, not a database column. Manifest save and authorize intersect requested permissions with it.
