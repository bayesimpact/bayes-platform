# RBAC Permission Matrix

Source of truth in code:

- Permission strings: `packages/api-contracts/src/rbac/permissions.ts`. This is the only declaration. The API imports them.
- Roles and grants: `apps/api/src/domains/rbac/rbac.constants.ts`. Role keys and which role receives which permission. It does not redeclare the strings.

This document mirrors those files. Whenever a role or a role/permission grant changes, update the matching table here in the same PR (see `.cursor/rules/permission-matrix.mdc` and the `check-permission-matrix` Claude skill).

A person can hold several roles on one organization, project, agent or review campaign: each role is its own `role_grant` row, and what the person can do there is the union of those roles ([ADR 0032](adr/0032-several-roles-per-resource.md)). Redundant combinations, such as `project_owner` with `project_admin`, are allowed. The role is `role_id`; the legacy `role` column is no longer read or written.

## Global roles

Global roles are stored as `role_grant` rows with `resource_type = 'global'`. `platform_staff` is renamed from `org_creator` and seeded by email domain (`SeedPlatformStaffByEmailDomain` / `ORGANIZATION_CREATOR_EMAIL_DOMAIN`). `platform_superadmin` is seeded from `BACKOFFICE_AUTHORIZED_EMAILS` by `SeedPlatformSuperadminByEmails`. The app itself never reads those env vars for authorization. `platform_staff` holds global `backoffice.project.read`. It does not hold `backoffice.user.read`, so the backoffice project page lists only the members it can read as users through `listUserIds`, and counts the others. `backoffice.app.manage` is superadmin-only: it manages the app manifests and their OAuth clients. `backoffice.maintenance_job.run` is superadmin-only: it lists and runs the one-off maintenance jobs of the backoffice. `backoffice.conversation_reviewer.update` lets the backoffice grant or revoke `agent_conversation_reviewer` on an agent (see Agent roles). `platform_org_creator` only opens the backoffice and creates organizations, as their owner. `backoffice.global_role.update` is superadmin-only: it grants or revokes the global roles of a user from the backoffice user page, and the last superadmin cannot lose that role.

| Permission | `platform_staff` | `platform_superadmin` | `platform_org_creator` |
|---|---|---|---|
| `backoffice.app.manage` — manage app definitions in the backoffice | — | ✅ | — |
| `backoffice.maintenance_job.run` — see and run the one-off maintenance jobs of the backoffice | — | ✅ | — |
| `backoffice.read` — access `/backoffice` routes | ✅ | ✅ | ✅ |
| `trace.read` — see trace links | ✅ | ✅ | — |
| `backoffice.terms.update` — manage terms documents | — | ✅ | — |
| `backoffice.organization.read` — see every organization in the backoffice | — | ✅ | — |
| `backoffice.project.read` — see every project in the backoffice | ✅ | ✅ | — |
| `backoffice.project.update` — mutate projects from the backoffice (e.g. feature flags) | — | ✅ | — |
| `backoffice.agent.read` — see every agent in the backoffice | — | ✅ | — |
| `backoffice.user.read` — see every user in the backoffice | — | ✅ | — |
| `organization.create` — create organizations | — | ✅ | ✅ |
| `backoffice.conversation_reviewer.update` — grant or revoke, agent by agent, the right to read any of its conversations | — | ✅ | — |
| `backoffice.global_role.update` — grant or revoke a user's global roles | — | ✅ | — |

## Organization roles

Scoped to one organization via `role_grant` (`resource_type = 'organization'`). Org roles deliberately do not grant `project.read`: project visibility comes from project memberships, and from a review campaign role on one of the project's campaigns (see Review campaign roles). They do grant `backoffice.project.read` / `backoffice.agent.read` so org admins see those resources in the backoffice via inheritance. They do **not** grant `backoffice.project.update`: feature-flag writes stay on project memberships.

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

Scoped to one project via `role_grant` (`resource_type = 'project'`).

The evaluation permissions are never inherited from the organization: an organization role does not open a project's evaluation app, its datasets or its runs.

The `project.member.*` permissions are not inherited either: an organization role does not let anyone see a project's members, invite to a project, change a member's role or remove a member.

The `resource_library.*` permissions are not inherited either: an organization role does not open a project's resource libraries.

The `*.ui.read` permissions open one user interface of the project each and are not inherited from the organization. They are exposed on `ProjectDto.permissions`. No project role holds `tester.ui.read` or `reviewer.ui.read`: only a review campaign role gives them (see Review campaign roles).

The `csv_extraction_run.*` permissions are not inherited either: an organization role does not open a project's CSV extraction runs. Every project role holds the four live run permissions, while the `csv_extraction_run.playground.*` ones stay with owners and admins.

The `agent.conversation.session.*` permissions are not inherited either: an organization role does not open a project's conversations. Every project role holds the three live session permissions, while the `agent.conversation.session.playground.*` ones stay with owners and admins. Each caller only ever sees their own sessions. A review campaign tester also holds the read and create keys on the campaign's project (see Review campaign roles).

The `agent.extraction.session.*` permissions follow the same rule: an organization role does not open a project's extraction runs. Every project role holds the three live session permissions, while the `agent.extraction.session.playground.*` ones stay with owners and admins. Each caller only ever sees their own runs and the documents they uploaded for them.

The `project.agent_session_category.*` permissions are not inherited either: an organization role does not change a project's conversation categories.

The `project.agent_message_feedback.*` permissions are not inherited either: an organization role does not open a project's message feedback. Every project role can leave feedback, and so can a review campaign tester on the campaign's project, while reading it stays with owners and admins.

The `document_tag.*` permissions are not inherited either: an organization role does not open a project's document tags. Reading and changing them stays with project owners and admins.

The `project.mcp_server.*` permissions are not inherited either: an organization role does not open a project's MCP servers. Every project role sees them, while adding, connecting, toggling and deleting stay with owners and admins.

The `project.app_installation.*` permissions are not inherited either: project owners and admins install apps on the project, see them and revoke them.

The `project.review_campaign.*` permissions are not inherited either: an organization role does not open a project's review campaigns. Managing them, inviting testers and reviewers and removing them stays with project owners and admins. `review_campaign.report.read` is granted on project owners and admins and passes down to every campaign of the project (see Review campaign roles).

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
| `project.app_installation.read` — see the apps installed on the project | ✅ | ✅ | — |
| `project.app_installation.revoke` — revoke an app installed on the project | ✅ | ✅ | — |
| `project.app_installation.create` — install an app on the project | ✅ | ✅ | — |
| `agent.conversation.session.external.create` — open conversations with the project's agents for people outside the platform | ✅ | ✅ | — |
| `project.review_campaign.read` — see the project's review campaigns | ✅ | ✅ | — |
| `project.review_campaign.create` — create a review campaign | ✅ | ✅ | — |
| `project.review_campaign.update` — update a review campaign | ✅ | ✅ | — |
| `project.review_campaign.delete` — delete a review campaign | ✅ | ✅ | — |
| `project.review_campaign.member.delete` — remove a tester or a reviewer from a review campaign | ✅ | ✅ | — |
| `project.review_campaign.member.invite` — invite testers and reviewers to a review campaign, see and revoke pending invitations | ✅ | ✅ | — |
| `review_campaign.report.read` — see the report of the project's review campaigns (passed down to each campaign) | ✅ | ✅ | — |
| `user.read` — see the project's members | ✅ | ✅ | — |
| `backoffice.project.read` — see the project in the backoffice | ✅ | ✅ | — |
| `backoffice.project.update` — mutate the project from the backoffice (e.g. feature flags) | ✅ | ✅ | — |
| `backoffice.agent.read` — see the project's agents in the backoffice | ✅ | ✅ | — |

## Agent roles

Scoped to one agent via `role_grant` (`resource_type = 'agent'`).

`agent_conversation_reviewer` is a row of its own on the agent, next to the person's owner, admin or member row if they have one. Its two permissions are checked with `@CheckPermission(AGENT_CONVERSATION_REVIEW_PERMISSION, "agent")` to read a conversation from its session id, and `@CheckPermission(AGENT_CONVERSATION_REVIEW_CATEGORY_READ_PERMISSION, "agent")` to list the agent's sessions grouped by category, and no parent passes either down. Nobody holds it by default, superadmins included; a holder of `backoffice.conversation_reviewer.update` grants it person by person from the backoffice agent page. The studio leaves it alone: the agent's member list, member removals and the project removal cascade only touch `agent_owner`, `agent_admin` and `agent_member`, and a reviewer grant does not make its holder visible through `user.read`.

The two analytics permissions are never inherited from a parent resource: an organization role does not open a project's analytics, and a project role does not open an agent's analytics.

The `agent.member.*` permissions are held on the agent only: a project or organization role does not let anyone see an agent's members, invite to an agent, change a member's roles there or remove a member.

`agent.sub_agent.read` and `agent.sub_agent.update` are held on the agent only as well: a project or organization role does not open an agent's sub-agents.

The same goes for `agent.settings.draft.update`, `agent.settings.draft.publish`, `agent.settings.restore` and `agent.settings.archive`: only an agent role lets someone change an agent's settings.

`agent.duplicate` is held on the agent only too, since the copy carries the agent's sub-agents. The copy is a new agent of the project, so duplicating also needs `agent.create` on the project.

`agent.settings.draft.read` works the other way: it is checked on the agent but granted on project owners and admins, and passes down to every agent of the project.

| Permission | `agent_owner` | `agent_admin` | `agent_member` | `agent_conversation_reviewer` |
|---|---|---|---|---|
| `agent.read` | ✅ | ✅ | ✅ | — |
| `agent.update` | ✅ | ✅ | — | — |
| `agent.delete` | ✅ | ✅ | — | — |
| `agent.duplicate` — copy the agent into a new draft agent of its project | ✅ | ✅ | — | — |
| `agent.analytics.read` — see the agent's conversation analytics | ✅ | ✅ | — | — |
| `agent.member.read` — see the agent's members and their roles | ✅ | ✅ | — | — |
| `agent.member.invite` — invite people to the agent, see and revoke pending invitations | ✅ | ✅ | — | — |
| `agent.member.delete` — remove a member from the agent | ✅ | ✅ | — | — |
| `agent.member.update` — give a member of the workspace a role on the agent, or take one away | ✅ | ✅ | — | — |
| `agent.sub_agent.read` — see the sub-agents the agent can call | ✅ | ✅ | — | — |
| `agent.sub_agent.update` — replace the sub-agents the agent can call | ✅ | ✅ | — | — |
| `agent.settings.draft.update` — edit the draft settings | ✅ | ✅ | — | — |
| `agent.settings.draft.publish` — publish the draft settings as a new revision | ✅ | ✅ | — | — |
| `agent.settings.restore` — restore an older revision of the settings into the draft | ✅ | ✅ | — | — |
| `agent.settings.archive` — archive a revision of the settings | ✅ | ✅ | — | — |
| `user.read` — see the agent's members | ✅ | ✅ | — | — |
| `backoffice.agent.read` — see the agent in the backoffice | ✅ | ✅ | — | — |
| `agent.conversation.review` — read any conversation of the agent from its session id (safety review) | — | — | — | ✅ |
| `agent.conversation.review.category.read` — list the agent's sessions grouped by category (safety review) | — | — | — | ✅ |

## Review campaign roles

Scoped to one review campaign via `role_grant` (`resource_type = 'review_campaign'`, `resource_id` = the campaign's id). Each row holds `review_campaign_tester` or `review_campaign_reviewer` in `role_id`. A person can hold both roles on one campaign: each one is its own row, revoked on its own.

Accepting an invitation to a campaign gives `review_campaign_tester` or `review_campaign_reviewer` on that campaign, plus `org_member` on the organization, since every organization-scoped route needs an organization row. It gives no project role. A campaign row without `role_id` gives nothing and is not read, so a new invitation to the same campaign adds a row with the role. Removing someone from a project also deletes their tester and reviewer roles on that project's campaigns. Since a participant stays `org_member`, provisioning one as a workspace owner later reports `granted_without_organization_admin` (preview: `would_grant_without_organization_admin`), and staff promote them on the organization by hand.

People who joined a campaign before these roles existed keep the `project_member` row the old invitation flow gave them. Migration `1791800888000-review-campaign-roles` deletes none of those rows, and sets `role_id` only for people who still hold a project row on the campaign's project. Migration `1792143739000-review-campaign-roles-backfill` runs the same backfill again, for the rows that pods running the old flow wrote while `1791800888000` rolled out. A later migration removes the `project_member` rows that campaign invitations created, once every running pod knows the campaign roles.

The `review_campaign.*` keys apply to the campaign. The organization passes none of them down, and the project passes down only `review_campaign.report.read` (`RESOURCE_TYPE_PERMISSIONS_MAP.review_campaign`), which project owners and admins hold (see Project roles).

A campaign role also gives the keys in `PROJECT_PERMISSIONS_FROM_REVIEW_CAMPAIGN` on the campaign's project: `project.read`, `tester.ui.read`, `reviewer.ui.read`, `agent.conversation.session.read`, `agent.conversation.session.create` and `project.agent_message_feedback.create`. Testers hold all of them but `reviewer.ui.read`, reviewers only `project.read` and `reviewer.ui.read`. The web app opens the tester and reviewer apps from the two `*.ui.read` keys on `ProjectDto.permissions`. This is the only grant that goes from a child resource up to its parent, and it holds only while the campaign is in one of the role's statuses in `REVIEW_CAMPAIGN_STATUSES_GIVING_PROJECT_PERMISSIONS`: active for a tester, active or closed for a reviewer. A draft campaign gives nothing. No other RBAC rule looks at the campaign status. The rule applies to `PermissionService.has`, `listResourceIds("project.read")` and `listResourcePermissions("project.read")`, so the project shows in the participant's project list. The live session routes check these keys on the project, so a tester reaches every agent of the project, as a project member could, until the session keys move to agent scope. The role's `review_campaign.*` keys never apply to the project.

The tester, reviewer and report routes check these keys with `@CheckPermission(..., "review_campaign")`, on the campaign of the URL or, for the routes under a session, on the session's campaign. No route reads the legacy `role` column any more. The campaign status stays out of these checks: `TesterService` and `ReviewerService` refuse with a 403 an action the status does not allow. Testing, giving feedback, the survey and reviewing need an active campaign. The tester context (shared with the reviewer landing page) and the reviewer's reading of sessions need it active or closed. The report has no status rule: participants only exist once a campaign is active, and project owners and admins see it on a draft too.

The last six rows apply to the campaign's project, and only while the campaign is in the status shown.

| Permission | `review_campaign_tester` | `review_campaign_reviewer` |
|---|---|---|
| `review_campaign.read` — see the campaign and its agent | ✅ | ✅ |
| `review_campaign.tester_session.read` — see your test conversations in the campaign | ✅ | — |
| `review_campaign.tester_session.create` — start a test conversation | ✅ | — |
| `review_campaign.tester_session.delete` — delete one of your test conversations | ✅ | — |
| `review_campaign.tester_feedback.create` — give feedback on one of your test conversations | ✅ | — |
| `review_campaign.tester_feedback.update` — change that feedback | ✅ | — |
| `review_campaign.tester_survey.read` — see your end-of-campaign survey answers | ✅ | — |
| `review_campaign.tester_survey.create` — answer the end-of-campaign survey | ✅ | — |
| `review_campaign.tester_survey.update` — change your survey answers | ✅ | — |
| `review_campaign.reviewer_session.read` — see the testers' conversations | — | ✅ |
| `review_campaign.reviewer_review.create` — review a tester's conversation | — | ✅ |
| `review_campaign.reviewer_review.update` — change your review | — | ✅ |
| `review_campaign.report.read` — see the campaign's report | — | ✅ |
| `project.read` — see the campaign's project, and find it in your project list | ✅ while active | ✅ while active or closed |
| `tester.ui.read` — open the project's tester app | ✅ while active | — |
| `reviewer.ui.read` — open the project's reviewer app | — | ✅ while active or closed |
| `agent.conversation.session.read` — see your live conversations with the project's agents | ✅ while active | — |
| `agent.conversation.session.create` — start a live conversation with one of the project's agents, attach a file | ✅ while active | — |
| `project.agent_message_feedback.create` — leave feedback on an agent's message | ✅ while active | — |

## App grantable permissions

Apps may only be granted the permissions in `APP_GRANTABLE_PERMISSIONS`, grouped by resource type: document (`document.read`, `document.create`, `document.update`, `document.delete`), document source (`document_source.read`, `document_source.create`, `document_source.update`, `document_source.delete`), document tag (`document_tag.read`, `document_tag.create`, `document_tag.update`, `document_tag.delete`), workspace (`project.read`, `project.update`, `project.delete`), and agent (`agent.read`, `agent.conversation.session.external.create`). `project.create` is not grantable. `agent.conversation.session.external.create` lets an App open conversations with the agents of its project for people outside the platform: project owners and admins hold it so they can grant it at install, and the install role passes it down from the project to its agents. Only the apps API checks it. This allowlist is code, not a database column. Manifest save and install intersect requested permissions with it, and an installer only grants the permissions they hold on the project.
