# ADR 0019: Permission Catalog, Role Grants, and Resource Listing

* **Status**: Accepted (supersedes the rights model in ADR 0004, including its rejection of a permissions table)
* **Date**: 2026-09-29
* **Deciders**: engineering
* **Scope**: `packages/api-contracts/src/rbac/permissions.ts`, `apps/api/src/domains/rbac/`, `docs/rbac-permission-matrix.md`

---

## 1. Context and Problem Statement

ADR 0004 stored a role on one of three membership tables and rejected a separate permissions table. ADR 0013 recorded one later choice: an org role that holds `project.read` would see every project in the organization.

The code no longer matches either description. Access is a permission string granted to a role, the role is attached to a `user_membership` row, and a feature service asks `PermissionService` which resources that permission covers. Agents keep re-deriving that from the guard, the constants, and the matrix doc.

## 2. Decision

**One permission string, granted on roles, checked on the route, and used to list resource ids.**

### 2.1 Catalog

* Permission strings are declared only in `packages/api-contracts/src/rbac/permissions.ts`. `GlobalPermission` lists the strings that are not tied to a resource id.
* Role keys and which role receives which permission live in `apps/api/src/domains/rbac/rbac.constants.ts`: `ORGANIZATION_ROLE_PERMISSIONS` (org roles plus `platform_staff` and `platform_superadmin`), `PROJECT_ROLE_PERMISSIONS`, and `AGENT_ROLE_PERMISSIONS`. The API file imports the strings. It does not declare them again.
* `docs/rbac-permission-matrix.md` mirrors that catalog and changes in the same commit. `.cursor/rules/permission-matrix.mdc` and the `check-permission-matrix` skill keep the mirror honest.
* `RbacService` seeds `role` and `role_permission` for tests and local `seed:rbac`. Production receives the same rows from a data migration. The process does not re-read the constants at startup.

### 2.2 Assignment

A `user_membership` row assigns a role to a user on a resource (`resource_type` + `resource_id`, or `global` with a null id). The row does not list permissions. The role does, through `role_permission`.

There is still no read-time guess of the form "an org owner may do everything in the org". A parent grants a child resource only the permissions that parent's role actually holds and that `RESOURCE_TYPE_PERMISSIONS_MAP` says apply to the child. Org roles do not grant `project.read`, so an org owner does not see every project. ADR 0013's grant is not in the catalog. The inheritance mechanism is: projects can inherit from the organization, agents from the organization and the project, when the parent role holds the requested key.

### 2.3 Endpoint check

`@CheckPermission(permission)` marks a route. `CheckPermissionGuard` runs after `JwtAuthGuard` and `UserGuard`.

* Without a resource type, the guard calls `PermissionService.hasGlobal`.
* With `"organization"`, `"project"`, or `"agent"`, it resolves the id from the request context or the route param and calls `PermissionService.has`. A global grant of the same key also passes.

The guard does not load the resource. Context resolvers still do that.

### 2.4 Listing

A service that returns "what this caller can see" calls `PermissionService.listResourceIds(userId, permission)` and then loads those ids. It does not query `user_membership` itself.

The permission key is the argument, and it must be a key of `READ_PERMISSION_RESOURCE_TYPE_MAP`. A global grant returns every live resource of that type. Otherwise the result is the resources whose role grants that exact key, plus children of parents whose role grants it. `backoffice.organization.read` stays that key. It is not rewritten to `organization.read`.

`listResourcePermissions` is the same selection with the caller's permission set on each id, for responses that carry those permissions.

## 3. Alternatives Considered

* **Role enum on the membership row (ADR 0004).** Rejected for the current model. Every new capability meant a new interpretation of the same role, and feature code reimplemented "which rows may this role see".
* **A permission check written in each service against `user_membership`.** Rejected. The grant, the parent walk, and the global case diverged between endpoints.
* **Re-reading `rbac.constants.ts` on every request.** Rejected. The database catalog is what production enforces, so a grant ships as a migration and can be rolled back.

## 4. Consequences

* A new capability is a constant, a role grant, a matrix row, a `role_permission` migration, and either `@CheckPermission` or a `listResourceIds` call.
* ADR 0004's three membership tables and its "no permissions table" alternative are not the model to implement.
* ADR 0013 remains the history of an org-scoped `project.read` grant. The catalog does not grant that key on org roles. Adding it back would be a catalog change under this ADR, not a new mechanism.
