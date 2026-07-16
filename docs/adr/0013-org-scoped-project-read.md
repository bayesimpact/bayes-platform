# ADR 0013: Org-Scoped `project.read` for Organization Index Visibility

* **Status**: Accepted
* **Date**: 2026-07-16
* **Deciders**: engineering
* **Scope**: Organization domain RBAC — `GET /organizations` nested projects, org roles `org_owner` / `org_admin`

---

## Decision

Org-scoped **`project.read`** (granted via `org_owner` / `org_admin` on an organization membership) means **organization-wide project visibility in index views** such as `GET /organizations`: users with that permission see every project in the org without requiring a per-project `user_membership` row. Users without it (e.g. `org_member`) still see only projects where they have an explicit `user_membership` with `resource_type = project`. This is intentional transitional pragmatism while `user_membership` remains the assignment store: it avoids tying home/onboarding lists to project membership rows for privileged org roles, without implementing full scoped-RBAC ancestor resolution yet. When point-in-time checks arrive (e.g. `can(user, "project.read", projectId)`), the same permission key should apply via org assignment on the parent organization; index listing and per-resource authorization must stay aligned on that single permission name.
