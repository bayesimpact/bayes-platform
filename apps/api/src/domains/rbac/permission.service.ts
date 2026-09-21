import { Injectable } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource } from "typeorm"
import type { PermissionResource, PermissionResourceType, RoleGrant } from "./permission.types"
import {
  BACKOFFICE_USER_READ_PERMISSION,
  CATALOG_ROLE_KEYS,
  PARENT_RESOURCE_TYPE_MAP,
  PERMISSION_DESCRIPTIONS,
  READ_PERMISSION_RESOURCE_TYPE_MAP,
  RESOURCE_TYPE_PERMISSIONS_MAP,
  type ResourceReadPermission,
  type RoleScopeType,
  USER_READ_PERMISSION,
} from "./rbac.constants"

type PermissionRow = { permissionKey: string }
type ResourcePermissionRow = { resourceId: string; permissionKey: string }
type ResourceIdRow = { resourceId: string }
type ChildResourceRow = { resourceId: string; parentResourceId: string }
type UserIdRow = { userId: string }
type RoleGrantRow = {
  roleId: string
  roleKey: string
  roleName: string
  permissionKey: string | null
}
type CatalogRoleRow = {
  roleKey: string
  roleName: string
  scopeType: RoleScopeType
  permissionKey: string | null
}
type GlobalRoleGrantRow = {
  roleKey: string
  roleName: string
  permissionKey: string | null
}

/**
 * Scope of visible users: holders of `backoffice.user.read` globally see the
 * whole directory ("all"); everyone else gets an explicit id list, so callers
 * can keep pagination in SQL without materializing every id.
 */
export type ResourceIdsScope = { scope: "all" } | { scope: "ids"; ids: string[] }

@Injectable()
export class PermissionService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async listGlobalPermissions(userId: string): Promise<string[]> {
    const rows: PermissionRow[] = await this.dataSource.query(
      `SELECT DISTINCT role_permission.permission_key AS "permissionKey"
       FROM user_membership membership
       INNER JOIN role_permission ON role_permission.role_id = membership.role_id
       WHERE membership.user_id = $1
         AND membership.resource_type = 'global'
         AND membership.resource_id IS NULL
         AND membership.role_id IS NOT NULL
         AND membership.deleted_at IS NULL`,
      [userId],
    )

    return rows.map((row) => row.permissionKey)
  }

  /** Permission keys granted by a single role, straight from the RBAC catalog. */
  async listPermissionsForRole(roleId: string): Promise<string[]> {
    const rows: PermissionRow[] = await this.dataSource.query(
      `SELECT role_permission.permission_key AS "permissionKey"
       FROM role_permission
       WHERE role_permission.role_id = $1
       ORDER BY role_permission.permission_key`,
      [roleId],
    )

    return rows.map((row) => row.permissionKey)
  }

  /**
   * Global roles held by the user (platform_staff / platform_superadmin),
   * each with the permission keys granted by that role.
   */
  async listGlobalRolesForUser(userId: string): Promise<RoleGrant[]> {
    const rows: GlobalRoleGrantRow[] = await this.dataSource.query(
      `SELECT role.key AS "roleKey",
              role.name AS "roleName",
              role_permission.permission_key AS "permissionKey"
       FROM user_membership membership
       INNER JOIN role ON role.id = membership.role_id
       LEFT JOIN role_permission ON role_permission.role_id = role.id
       WHERE membership.user_id = $1
         AND membership.resource_type = 'global'
         AND membership.role_id IS NOT NULL
         AND membership.deleted_at IS NULL
       ORDER BY role.key, role_permission.permission_key`,
      [userId],
    )

    return this.groupGlobalRoleGrants(rows)
  }

  /**
   * Catalog grants for the given role ids: key, display name, and permission keys.
   * Missing / unknown ids are omitted from the map.
   */
  async listRoleGrants(roleIds: string[]): Promise<Map<string, RoleGrant>> {
    const uniqueRoleIds = [...new Set(roleIds.filter((roleId) => roleId.length > 0))]
    if (uniqueRoleIds.length === 0) {
      return new Map()
    }

    const rows: RoleGrantRow[] = await this.dataSource.query(
      `SELECT role.id AS "roleId",
              role.key AS "roleKey",
              role.name AS "roleName",
              role_permission.permission_key AS "permissionKey"
       FROM role
       LEFT JOIN role_permission ON role_permission.role_id = role.id
       WHERE role.id = ANY($1)
       ORDER BY role.key, role_permission.permission_key`,
      [uniqueRoleIds],
    )

    return this.groupRoleGrantsByRoleId(rows)
  }

  /**
   * Official RBAC catalog: seeded roles and their permission keys, plus
   * descriptions for every known permission. Ad-hoc / leftover roles are omitted.
   */
  async getCatalog(): Promise<{
    roles: { key: string; name: string; scopeType: RoleScopeType; permissions: string[] }[]
    permissions: { key: string; description: string }[]
  }> {
    const catalogRoleKeys = [...CATALOG_ROLE_KEYS]
    const rows: CatalogRoleRow[] = await this.dataSource.query(
      `SELECT role.key AS "roleKey",
              role.name AS "roleName",
              role.scope_type AS "scopeType",
              role_permission.permission_key AS "permissionKey"
       FROM role
       LEFT JOIN role_permission ON role_permission.role_id = role.id
       WHERE role.key = ANY($1)
       ORDER BY role.key, role_permission.permission_key`,
      [catalogRoleKeys],
    )

    const grantsByKey = new Map<
      string,
      { key: string; name: string; scopeType: RoleScopeType; permissions: string[] }
    >()
    for (const row of rows) {
      const existing = grantsByKey.get(row.roleKey) ?? {
        key: row.roleKey,
        name: row.roleName,
        scopeType: row.scopeType,
        permissions: [],
      }
      if (row.permissionKey) {
        existing.permissions.push(row.permissionKey)
      }
      grantsByKey.set(row.roleKey, existing)
    }

    const catalogRoles = catalogRoleKeys.flatMap((roleKey) => {
      const role = grantsByKey.get(roleKey)
      return role ? [role] : []
    })

    const permissionKeys = new Set<string>(Object.keys(PERMISSION_DESCRIPTIONS))
    for (const catalogRole of catalogRoles) {
      for (const permissionKey of catalogRole.permissions) {
        permissionKeys.add(permissionKey)
      }
    }

    const permissions = [...permissionKeys]
      .sort((left, right) => left.localeCompare(right))
      .map((permissionKey) => ({
        key: permissionKey,
        description: PERMISSION_DESCRIPTIONS[permissionKey] ?? "",
      }))

    return { roles: catalogRoles, permissions }
  }

  /**
   * Returns all resource ids that the user has access to, including:
   * - a global grant of the permission (every alive resource of the mapped type)
   * - direct access (membership on the resource whose role grants the key)
   * - access through parent resources (same key on an ancestor role)
   *
   * Permission-first API: the resource type is resolved from the permission
   * key (e.g. `organization.read` / `backoffice.organization.read` -> organization).
   * The *requested* key is used end-to-end — no remapping to a "canonical" read
   * permission — so granting `backoffice.organization.read` on an org role is
   * enough for scoped backoffice listings.
   *
   * WARNING: this does not return the permissions for the resources, only the ids.
   * To get the permissions, use listResourcePermissions instead.
   */
  async listResourceIds(userId: string, readPermission: ResourceReadPermission): Promise<string[]> {
    const resourceType = READ_PERMISSION_RESOURCE_TYPE_MAP[readPermission]

    if (await this.hasGlobal(userId, readPermission)) {
      return this.listAllAliveResourceIds(resourceType)
    }

    const directResourceIds = await this.listResourceIdsMatchingPermission(
      userId,
      resourceType,
      readPermission,
    )
    const resourceIdsFromParents: string[] = []

    // every parent resource type contributes: a user can inherit access through
    // several sources at once (e.g. an org role AND a project role for agents),
    // so the loop accumulates instead of stopping at the first match
    for (const parentResourceType of PARENT_RESOURCE_TYPE_MAP[resourceType]) {
      // parent resources qualify when their role grants the *requested* permission
      const parentResourceIds = await this.listResourceIdsMatchingPermission(
        userId,
        parentResourceType,
        readPermission,
      )
      if (parentResourceIds.length === 0) continue

      const childRows = await this.fetchChildResourceRows(
        resourceType,
        parentResourceType,
        parentResourceIds,
      )
      resourceIdsFromParents.push(...childRows.map((row) => row.resourceId))
    }

    return [...new Set([...directResourceIds, ...resourceIdsFromParents])]
  }

  /**
   * Same as listResourceIds, but returns the effective permissions per resource id:
   * - direct access: the permissions of the role held on the resource itself
   * - access through a parent resource: the parent's permissions, filtered down to the
   *   ones that apply to the requested resource type (RESOURCE_TYPE_PERMISSIONS_MAP)
   *
   * Permission-first API: the resource type is resolved from the read
   * permission key (e.g. `organization.read` -> organization).
   */
  async listResourcePermissions(
    userId: string,
    readPermission: ResourceReadPermission,
  ): Promise<Map<string, string[]>> {
    const resourceType = READ_PERMISSION_RESOURCE_TYPE_MAP[readPermission]
    const permissionsByResourceId = await this.listDirectResourcePermissions(userId, resourceType)
    // permissions that apply to the requested resource type (e.g. project -> project.*)
    const resourceTypePermissions: readonly string[] = RESOURCE_TYPE_PERMISSIONS_MAP[resourceType]

    // every parent resource type contributes: a user can inherit access through
    // several sources at once (e.g. an org role AND a project role for agents),
    // so the loop accumulates instead of stopping at the first match
    for (const parentResourceType of PARENT_RESOURCE_TYPE_MAP[resourceType]) {
      // parent resources qualify when their role grants the read permission
      // for the requested resource type (the full permission set is then conveyed)
      const parentPermissionsByParentId =
        await this.listDirectResourcePermissionsMatchingPermission(
          userId,
          parentResourceType,
          readPermission,
        )
      if (parentPermissionsByParentId.size === 0) continue

      const childResourceRows = await this.fetchChildResourceRows(
        resourceType,
        parentResourceType,
        Array.from(parentPermissionsByParentId.keys()),
      )

      for (const { resourceId, parentResourceId } of childResourceRows) {
        // intersection: only keep the parent's permissions that apply to the requested resource type
        const inheritedPermissions = (
          parentPermissionsByParentId.get(parentResourceId) ?? []
        ).filter((permission) => resourceTypePermissions.includes(permission))

        // union: inherited permissions add to (never replace) already collected ones
        const collectedPermissions = permissionsByResourceId.get(resourceId) ?? []
        permissionsByResourceId.set(resourceId, [
          ...new Set([...collectedPermissions, ...inheritedPermissions]),
        ])
      }
    }

    return permissionsByResourceId
  }

  /** Permissions granted by roles held directly on resources of the given type. */
  private async listDirectResourcePermissions(
    userId: string,
    resourceType: PermissionResourceType,
  ): Promise<Map<string, string[]>> {
    const rows: ResourcePermissionRow[] = await this.dataSource.query(
      `SELECT membership.resource_id AS "resourceId",
              role_permission.permission_key AS "permissionKey"
       FROM user_membership membership
       INNER JOIN role_permission ON role_permission.role_id = membership.role_id
       WHERE membership.user_id = $1
         AND membership.resource_type = $2
         AND membership.resource_id IS NOT NULL
         AND membership.deleted_at IS NULL`,
      [userId, resourceType],
    )

    return this.groupPermissionsByResourceId(rows)
  }

  /**
   * All permissions granted by roles held directly on resources of the given type,
   * restricted to the resources whose role also grants the given permission.
   * (the permission gates WHICH resources qualify; the full permission set is returned)
   */
  private async listDirectResourcePermissionsMatchingPermission(
    userId: string,
    resourceType: PermissionResourceType,
    permission: string,
  ): Promise<Map<string, string[]>> {
    const rows: ResourcePermissionRow[] = await this.dataSource.query(
      `SELECT membership.resource_id AS "resourceId",
              role_permission.permission_key AS "permissionKey"
       FROM user_membership membership
       INNER JOIN role_permission ON role_permission.role_id = membership.role_id
       WHERE membership.user_id = $1
         AND membership.resource_type = $2
         AND membership.resource_id IS NOT NULL
         AND membership.deleted_at IS NULL
         AND EXISTS (
           SELECT 1
           FROM role_permission required_permission
           WHERE required_permission.role_id = membership.role_id
             AND required_permission.permission_key = $3
         )`,
      [userId, resourceType, permission],
    )

    return this.groupPermissionsByResourceId(rows)
  }

  private async listResourceIdsMatchingPermission(
    userId: string,
    resourceType: PermissionResourceType,
    readPermission: string,
  ): Promise<string[]> {
    const rows: ResourceIdRow[] = await this.dataSource.query(
      `SELECT DISTINCT membership.resource_id AS "resourceId"
       FROM user_membership membership
       INNER JOIN role_permission ON role_permission.role_id = membership.role_id
       WHERE membership.user_id = $1
         AND membership.resource_type = $2
         AND membership.resource_id IS NOT NULL
         AND membership.deleted_at IS NULL
         AND role_permission.permission_key = $3`,
      [userId, resourceType, readPermission],
    )
    return rows.map((row) => row.resourceId)
  }

  /** Every alive resource id of the given type (used when the permission is held globally). */
  private async listAllAliveResourceIds(resourceType: PermissionResourceType): Promise<string[]> {
    const query = ALL_ALIVE_RESOURCE_IDS_QUERIES[resourceType]
    if (!query) {
      return []
    }

    const rows: ResourceIdRow[] = await this.dataSource.query(query)
    return rows.map((row) => row.resourceId)
  }

  /**
   * Which users is this user allowed to see?
   * - `backoffice.user.read` held globally: the whole directory ({ scope: "all" })
   * - otherwise: themselves, plus the members of every resource on which the
   *   user holds a role granting `user.read` (same-resource members only:
   *   an org role granting user.read shows the org's members, not the members
   *   of every project of the org)
   *
   * NOTE: agent memberships are covered when the agent role grants `user.read`
   * (agent_owner / agent_admin) and `role_id` is set on the membership.
   */
  async listUserIds(userId: string): Promise<ResourceIdsScope> {
    if (await this.hasGlobal(userId, BACKOFFICE_USER_READ_PERMISSION)) {
      return { scope: "all" }
    }

    const rows: UserIdRow[] = await this.dataSource.query(
      `SELECT DISTINCT other_membership.user_id AS "userId"
       FROM user_membership my_membership
       INNER JOIN role_permission ON role_permission.role_id = my_membership.role_id
         AND role_permission.permission_key = $2
       INNER JOIN user_membership other_membership
         ON other_membership.resource_type = my_membership.resource_type
         AND other_membership.resource_id = my_membership.resource_id
         AND other_membership.deleted_at IS NULL
       INNER JOIN "user" other_user
         ON other_user.id = other_membership.user_id
         AND other_user.deleted_at IS NULL
         AND other_user.type = $3
       WHERE my_membership.user_id = $1
         AND my_membership.resource_id IS NOT NULL
         AND my_membership.deleted_at IS NULL`,
      [userId, USER_READ_PERMISSION, "human"],
    )

    const visibleUserIds = new Set<string>([userId, ...rows.map((row) => row.userId)])
    return { scope: "ids", ids: [...visibleUserIds] }
  }

  async hasGlobal(userId: string, permission: string): Promise<boolean> {
    const matches: { allowed: number }[] = await this.dataSource.query(
      `SELECT 1 AS allowed
       FROM user_membership membership
       INNER JOIN role_permission ON role_permission.role_id = membership.role_id
       WHERE membership.user_id = $1
         AND membership.resource_type = 'global'
         AND membership.resource_id IS NULL
         AND membership.role_id IS NOT NULL
         AND membership.deleted_at IS NULL
         AND role_permission.permission_key = $2
       LIMIT 1`,
      [userId, permission],
    )

    return matches.length > 0
  }

  /**
   * Whether the user holds the permission on the resource, either through a
   * global role granting the permission everywhere, a role held directly on
   * the resource, or inherited from a role on an ancestor resource (e.g. an
   * org role granting `project.read` applies to every project of the org).
   *
   * Inheritance is gated by RESOURCE_TYPE_PERMISSIONS_MAP, with the same
   * semantics as listResourcePermissions: a parent role only conveys the
   * permissions that apply to the child resource type.
   */
  async has(userId: string, permission: string, resource: PermissionResource): Promise<boolean> {
    if (await this.hasGlobal(userId, permission)) {
      return true
    }

    if (await this.hasDirectly(userId, permission, resource)) {
      return true
    }

    // a permission that does not apply to this resource type can never be inherited
    const resourceTypePermissions: readonly string[] = RESOURCE_TYPE_PERMISSIONS_MAP[resource.type]
    if (!resourceTypePermissions.includes(permission)) {
      return false
    }

    for (const parentResourceType of PARENT_RESOURCE_TYPE_MAP[resource.type]) {
      const parentResourceId = await this.fetchParentResourceId(resource, parentResourceType)
      if (!parentResourceId) {
        continue
      }

      const hasPermissionOnParent = await this.hasDirectly(userId, permission, {
        type: parentResourceType,
        id: parentResourceId,
      })
      if (hasPermissionOnParent) {
        return true
      }
    }

    return false
  }

  /** Whether a role held directly on the resource grants the permission. */
  private async hasDirectly(
    userId: string,
    permission: string,
    resource: PermissionResource,
  ): Promise<boolean> {
    const matches: { allowed: number }[] = await this.dataSource.query(
      `SELECT 1 AS allowed
       FROM user_membership membership
       INNER JOIN role_permission ON role_permission.role_id = membership.role_id
       WHERE membership.user_id = $1
         AND membership.resource_type = $2
         AND membership.resource_id = $3
         AND membership.role_id IS NOT NULL
         AND membership.deleted_at IS NULL
         AND role_permission.permission_key = $4
       LIMIT 1`,
      [userId, resource.type, resource.id, permission],
    )

    return matches.length > 0
  }

  /** Resolves the id of the resource's ancestor of the given type, if any. */
  private async fetchParentResourceId(
    resource: PermissionResource,
    parentResourceType: PermissionResourceType,
  ): Promise<string | null> {
    const query = PARENT_RESOURCE_ID_QUERIES[resource.type]?.[parentResourceType]
    if (!query) {
      return null
    }

    const rows: { parentResourceId: string }[] = await this.dataSource.query(query, [resource.id])
    return rows[0]?.parentResourceId ?? null
  }

  private groupPermissionsByResourceId(rows: ResourcePermissionRow[]): Map<string, string[]> {
    const permissionsByResourceId = new Map<string, string[]>()
    for (const row of rows) {
      const resourcePermissions = permissionsByResourceId.get(row.resourceId) ?? []
      resourcePermissions.push(row.permissionKey)
      permissionsByResourceId.set(row.resourceId, resourcePermissions)
    }

    return permissionsByResourceId
  }

  private groupRoleGrantsByRoleId(rows: RoleGrantRow[]): Map<string, RoleGrant> {
    const grantsByRoleId = new Map<string, RoleGrant>()
    for (const row of rows) {
      const existing = grantsByRoleId.get(row.roleId) ?? {
        key: row.roleKey,
        name: row.roleName,
        permissions: [],
      }
      if (row.permissionKey) {
        existing.permissions.push(row.permissionKey)
      }
      grantsByRoleId.set(row.roleId, existing)
    }

    return grantsByRoleId
  }

  private groupGlobalRoleGrants(rows: GlobalRoleGrantRow[]): RoleGrant[] {
    const grantsByKey = new Map<string, RoleGrant>()
    for (const row of rows) {
      const existing = grantsByKey.get(row.roleKey) ?? {
        key: row.roleKey,
        name: row.roleName,
        permissions: [],
      }
      if (row.permissionKey) {
        existing.permissions.push(row.permissionKey)
      }
      grantsByKey.set(row.roleKey, existing)
    }

    return [...grantsByKey.values()]
  }

  /**
   * Expands parent resource ids into their child resource rows,
   * e.g. all projects (resourceId) of the given organizations (parentResourceId).
   */
  private async fetchChildResourceRows(
    resourceType: PermissionResourceType,
    parentResourceType: PermissionResourceType,
    parentResourceIds: string[],
  ): Promise<ChildResourceRow[]> {
    const query = CHILD_RESOURCE_ROWS_QUERIES[resourceType]?.[parentResourceType]
    if (!query) {
      return []
    }

    return this.dataSource.query(query, [parentResourceIds])
  }
}

/** Every alive resource id of a given type (global-permission fast path). */
const ALL_ALIVE_RESOURCE_IDS_QUERIES: Record<PermissionResourceType, string> = {
  organization: `SELECT organization.id AS "resourceId"
                 FROM organization
                 WHERE organization.deleted_at IS NULL`,
  project: `SELECT project.id AS "resourceId"
            FROM project
            WHERE project.deleted_at IS NULL`,
  agent: `SELECT agent.id AS "resourceId"
          FROM agent
          WHERE agent.deleted_at IS NULL`,
}

/**
 * One declarative SQL query per (child resource type -> parent resource type) pair,
 * resolving the parent id of a single child resource ($1 = child id).
 * Mirror of CHILD_RESOURCE_ROWS_QUERIES.
 *
 * Every resource on the path (child, intermediate, parent) must be alive:
 * a soft-deleted resource never conveys permissions.
 */
const PARENT_RESOURCE_ID_QUERIES: Partial<
  Record<PermissionResourceType, Partial<Record<PermissionResourceType, string>>>
> = {
  project: {
    organization: `SELECT project.organization_id AS "parentResourceId"
                   FROM project
                   INNER JOIN organization ON organization.id = project.organization_id
                     AND organization.deleted_at IS NULL
                   WHERE project.id = $1
                     AND project.deleted_at IS NULL`,
  },
  agent: {
    organization: `SELECT agent.organization_id AS "parentResourceId"
                   FROM agent
                   INNER JOIN project ON project.id = agent.project_id
                     AND project.deleted_at IS NULL
                   INNER JOIN organization ON organization.id = agent.organization_id
                     AND organization.deleted_at IS NULL
                   WHERE agent.id = $1
                     AND agent.deleted_at IS NULL`,
    project: `SELECT agent.project_id AS "parentResourceId"
              FROM agent
              INNER JOIN project ON project.id = agent.project_id
                AND project.deleted_at IS NULL
              WHERE agent.id = $1
                AND agent.deleted_at IS NULL`,
  },
}

/**
 * One declarative SQL query per (child resource type -> parent resource type) pair.
 *
 * Every resource on the path (child, intermediate, parent) must be alive:
 * a soft-deleted resource never conveys permissions.
 */
const CHILD_RESOURCE_ROWS_QUERIES: Partial<
  Record<PermissionResourceType, Partial<Record<PermissionResourceType, string>>>
> = {
  project: {
    organization: `SELECT project.id AS "resourceId",
                          project.organization_id AS "parentResourceId"
                   FROM project
                   INNER JOIN organization ON organization.id = project.organization_id
                     AND organization.deleted_at IS NULL
                   WHERE project.organization_id = ANY($1)
                     AND project.deleted_at IS NULL`,
  },
  agent: {
    organization: `SELECT agent.id AS "resourceId",
                          agent.organization_id AS "parentResourceId"
                   FROM agent
                   INNER JOIN project ON project.id = agent.project_id
                     AND project.deleted_at IS NULL
                   INNER JOIN organization ON organization.id = agent.organization_id
                     AND organization.deleted_at IS NULL
                   WHERE agent.organization_id = ANY($1)
                     AND agent.deleted_at IS NULL`,
    project: `SELECT agent.id AS "resourceId",
                     agent.project_id AS "parentResourceId"
              FROM agent
              INNER JOIN project ON project.id = agent.project_id
                AND project.deleted_at IS NULL
              WHERE agent.project_id = ANY($1)
                AND agent.deleted_at IS NULL`,
  },
}
