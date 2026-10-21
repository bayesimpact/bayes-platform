# ADR 0032: Several roles per person on one resource

* **Status**: Accepted
* **Date**: 2026-10-21
* **Deciders**: Jérémie, Didier
* **Amends**: [ADR 0019](0019-rbac-permission-catalog.md) (how roles are held)
* **Scope**: `apps/api` (`domains/memberships`, the membership domains of organizations, projects, agents and review campaigns, `domains/rbac`), API contracts.

---

## 1. Context

`user_membership` allowed one row per person and resource on organizations,
projects and agents (`UQ_user_membership_non_campaign`), so a person held a
single role there. With the RBAC catalog (ADR 0019) a role is a bundle of
permissions, and some features need a second one on the same resource. Each
one worked around the rule:

* review campaigns had their own index, keyed on the legacy `role` string, so
  a person could be tester and reviewer;
* global roles had their own index on `role_id`;
* app installs used a dedicated service user per installation;
* the conversation safety review held `agent_conversation_reviewer` on
  `temp_agent` rows (resource id = agent id), a resource type of its own, so
  it would not replace the person's role on the agent.

`PermissionService` already took the union of the permissions over every row
a person holds. What stood in the way was the unique index and the code that
read "the" role of a person on a resource from the legacy `role` column.

The members page rework (#613) shows and edits every role a member holds on
the workspace, its agents and its review campaigns.

## 2. Decision

**A person can hold several roles on one resource, one `user_membership` row
per role.** Their permissions there are the union of those roles.

* One unique index, `UQ_user_membership_role`, on (user, resource type,
  resource, `role_id`) for every resource type but `global`, which keeps
  `UQ_user_membership_global` on (user, `role_id`). Each role is held once.
* Nothing prevents redundant combinations, such as `project_owner` with
  `project_admin` and `project_member`. More granular roles will come later;
  until then the code does not try to keep the set minimal.
* The role of a row is `role_id`. The legacy `role` string is no longer read
  or written; it is nullable and a follow-up drops it. The migration gives a
  `role_id` to the last rows that only had the string.
* `temp_agent` is gone: the `agent_conversation_reviewer` grants are plain
  `agent` rows, checked with `@CheckPermission(..., "agent")`. No parent passes
  `agent.conversation.review` down, so nothing changes in who can review.
* Admins cannot create roles: the catalog stays the one in `rbac.constants.ts`.
  Invitations are unchanged: accepting one gives the roles it gave before.

### How the code that expected one role keeps working

* **Reads group rows by person.** The organization, project and agent
  membership models carry `roles` (catalog key, name, scope, and the row that
  holds each). Their `id` is the person's oldest row on the resource, and the
  routes that take a membership id accept any of the person's rows.
* **DTOs expose `roles: { membershipId, key, name, scopeType }[]`** in place
  of the single `role`, on the project, agent, organization, review campaign,
  `me` and backoffice membership DTOs. A campaign participant is one entry
  with one role per row, each still revoked on its own.
* **Role changes switch rows.** Moving someone between `project_admin` and
  `project_member` updates the row in place (the membership keeps its id), or
  drops it when they already hold the target role. The agent cascade follows:
  admin on every agent of the project when promoted, member instead of admin
  when demoted. Other roles, ownership included, stay.
* **Guards**: nobody changes their own roles, and a project keeps at least one
  `project_owner`. Removing an owner is allowed while another one remains, in
  place of the old "the owner cannot be removed".
* **Removal** from a project deletes every project role of the person, their
  agent member roles in the project and their campaign roles there.
* **The conversation reviewer grant belongs to the backoffice.** The studio's
  agent member list, member removals and the project removal cascade only
  touch `agent_owner`, `agent_admin` and `agent_member`, and a reviewer grant
  does not make its holder visible through `user.read`.
* **Upserts look for the role they need**, not for any row: an invitation to an
  agent gives `agent_member` to a person who only reviews it, and making an
  owner admin adds `project_admin` next to ownership.

## 3. Consequences

* The web app reads `roles`. Until the members page is wired (#1076, #1077),
  the current screens show the highest of owner, admin and member.
* `PermissionService.listResourcePermissions` returns each key once per
  resource, and a parent resource qualifies when any of the person's roles on
  it grants the read permission.
* The migration's `down` puts back one row per person and resource outside
  campaigns, keeping the highest of owner, admin and member: the other roles
  are lost.
* Bulk role edits on the members page (#1075) add and remove rows; they need no
  schema change.
