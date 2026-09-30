---
name: rbac
description: Protect an API endpoint with a permission and load the caller's authorized resource ids through PermissionService. Use when adding or changing a permission, a role grant, @CheckPermission, CheckPermissionGuard, or a list of resources the caller can see.
---

# RBAC

Permissions are declared once, granted on roles in the catalog, checked on the route, and used to list what the caller can see. Do not query `user_membership` or `role_permission` from a feature service.

This skill explains how to use the model. It does not replace:

- `.cursor/rules/permission-matrix.mdc` — keep `docs/rbac-permission-matrix.md` in sync
- `.claude/skills/check-permission-matrix/SKILL.md` — audit that the matrix matches the catalog
- [ADR 0019](../../../docs/adr/0019-rbac-permission-catalog.md) — why the model is shaped this way

## 1. Declare the permission

In `packages/api-contracts/src/rbac/permissions.ts`, add one string constant. This file is the only place a permission string is declared.

```typescript
export const PROJECT_ARCHIVE_PERMISSION = "project.archive" as const
```

If the permission is global (no resource id), add it to the `GlobalPermission` union in the same file.

Import the constant into `apps/api/src/domains/rbac/rbac.constants.ts` and re-export it from the existing export block. Do not redeclare the string there.

Add a one-line entry to `PERMISSION_DESCRIPTIONS` in that file.

## 2. Grant it on a role

Add the constant to the role arrays that should hold it:

- `ORGANIZATION_ROLE_PERMISSIONS` — org roles, and the global `platform_staff` / `platform_superadmin` roles
- `PROJECT_ROLE_PERMISSIONS`
- `AGENT_ROLE_PERMISSIONS`

Org roles do not grant `project.read`. Project visibility comes from a project membership, unless a parent role is explicitly given the requested key.

If `PermissionService.listResourceIds` or `listResourcePermissions` must accept the new key, add it to `READ_PERMISSION_RESOURCE_TYPE_MAP`. Only keys in that map are valid listing permissions (`organization.read`, `project.read`, `agent.read`, and the matching `backoffice.*.read` keys).

If a parent membership should pass the permission down to a child resource, add it to `RESOURCE_TYPE_PERMISSIONS_MAP` for the child type. A parent grant is ignored for keys absent from that list. `PARENT_RESOURCE_TYPE_MAP` already says which parents exist: projects inherit from the organization, agents inherit from the organization and the project.

Update the matching table in `docs/rbac-permission-matrix.md` in the same change. Run the `check-permission-matrix` skill before finishing.

The running database does not read the constants. Tests and `seed:rbac` go through `RbacService`. Production learns a new grant from a data migration that inserts `role_permission` rows, as in `apps/api/src/migrations/1790269217250-analytics-read-permissions.ts`. `migration:generate` will not emit that insert: there is no schema diff. Follow that migration (insert in `up`, delete in `down`, `ON CONFLICT DO NOTHING`). A new role also needs a `role` row, a label in `RbacService`, and an entry in `CATALOG_ROLE_KEYS`.

## 3. Protect the route

Put `CheckPermissionGuard` after `JwtAuthGuard` and `UserGuard`. The guard reads `request.user.id`.

Global permission — no resource id. `CheckPermissionGuard` calls `PermissionService.hasGlobal`:

```typescript
@Post(OrganizationsRoutes.createOne.path)
@UseGuards(JwtAuthGuard, UserGuard, CheckPermissionGuard)
@CheckPermission(ORGANIZATION_CREATE_PERMISSION)
async createOrganization() {}
```

Scoped permission — pass the resource type. The guard calls `PermissionService.has` for that id:

```typescript
@Patch(OrganizationsRoutes.updateOne.path)
@UseGuards(JwtAuthGuard, UserGuard, OrganizationGuard, CheckPermissionGuard)
@CheckPermission("organization.update", "organization")
async updateOrganization() {}
```

The second argument is `"organization"`, `"project"`, or `"agent"`. `resolvePermissionResourceId` reads the id already on the request (`organizationId`, `project.id`, `agent.id`) and otherwise the route param (`organizationId`, `projectId`, `agentId`). Keep the context resolver or domain guard that sets that id. `CheckPermissionGuard` only answers whether the permission holds.

Import `CheckPermission` from `apps/api/src/domains/rbac/check-permission.decorator.ts` and `CheckPermissionGuard` from `check-permission.guard.ts`. Use the exported permission constant when one exists.

A missing permission throws `ForbiddenException`. A scoped check with no resource id throws `BadRequestException`.

## 4. List what the caller can see

A service that lists resources asks `PermissionService`. It does not query memberships and then filter.

Ids only — then load those rows in the custom repository:

```typescript
const organizationIds = await this.permissionService.listResourceIds(
  userId,
  BACKOFFICE_ORGANIZATION_READ_PERMISSION,
)
```

Ids plus the permissions to put on each row (what `ProjectsService` does):

```typescript
const permissionsByProjectId = await this.permissionService.listResourcePermissions(
  userId,
  "project.read",
)
return this.projectRepository.findAllByIds(permissionsByProjectId)
```

`listResourceIds(userId, permission)` returns:

- every live resource of that type, when the caller holds the permission globally
- resources where the caller's role grants that exact key
- child resources whose parent role grants that same key

The argument is the permission you mean. `backoffice.organization.read` is not rewritten to `organization.read`.

Reference: `apps/api/src/domains/backoffice/backoffice.service.ts` (`listResourceIds`), `apps/api/src/domains/projects/projects.service.ts` (`listResourcePermissions`).

## Checklist

- [ ] Constant in `packages/api-contracts/src/rbac/permissions.ts` (and `GlobalPermission` when global)
- [ ] Imported in `rbac.constants.ts`, granted on the role, described in `PERMISSION_DESCRIPTIONS`
- [ ] `READ_PERMISSION_RESOURCE_TYPE_MAP` / `RESOURCE_TYPE_PERMISSIONS_MAP` updated when the key is listed or inherited
- [ ] `docs/rbac-permission-matrix.md` updated
- [ ] Data migration inserts the `role_permission` rows
- [ ] Route uses `@CheckPermission` and `CheckPermissionGuard`
- [ ] Listing goes through `listResourceIds` or `listResourcePermissions`
