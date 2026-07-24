import { Injectable } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource } from "typeorm"
import type { PermissionResource, PermissionResourceType } from "./permission.types"
import {
  PARENT_RESOURCE_TYPE_MAP,
  RESOURCE_TYPE_PERMISSIONS_MAP,
  RESOURCE_TYPE_READ_PERMISSION_MAP,
} from "./rbac.constants"

type PermissionRow = { permissionKey: string }
type ResourcePermissionRow = { resourceId: string; permissionKey: string }
type ResourceIdRow = { resourceId: string }
type ChildResourceRow = { resourceId: string; parentResourceId: string }

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
   * Returns all resource ids that the user has access to, including:
   * - direct access (easy)
   * - access through parent resources (slightly harder)
   *
   * WARNING: this does not return the permissions for the resources, only the ids.
   * To get the permissions, use listResourcePermissions instead.
   */
  async listResourceIds(userId: string, resourceType: PermissionResourceType): Promise<string[]> {
    // the goal is to retrieve all resource ids that the user has access to, including:
    // - direct access (easy)
    // - access through parent resources (slightly harder)

    const directResourceIds = await this.listResourceIdsFromDirectAccess(userId, resourceType)
    let resourceIdsFromParent = [] as string[]

    // from top level resource types (org) to child resource types (project), find a parent resource which
    // owns the read permission for the requested resource type.
    for (const parentResourceType of PARENT_RESOURCE_TYPE_MAP[resourceType]) {
      const parentResourceIds = await this.listResourceIdsMatchingPermission(
        userId,
        parentResourceType,
        RESOURCE_TYPE_READ_PERMISSION_MAP[resourceType],
      )

      if (parentResourceIds.length > 0) {
        const childRows = await this.fetchChildResourceRows(
          resourceType,
          parentResourceType,
          parentResourceIds,
        )
        resourceIdsFromParent = childRows.map((row) => row.resourceId)
        break
      }
    }

    return [...new Set([...directResourceIds, ...resourceIdsFromParent])]
  }

  /**
   * Same as listResourceIds, but returns the effective permissions per resource id:
   * - direct access: the permissions of the role held on the resource itself
   * - access through a parent resource: the parent's permissions, filtered down to the
   *   ones that apply to the requested resource type (RESOURCE_TYPE_PERMISSIONS_MAP)
   */
  async listResourcePermissions(
    userId: string,
    resourceType: PermissionResourceType,
  ): Promise<Map<string, string[]>> {
    const permissionsByResourceId = await this.listDirectResourcePermissions(userId, resourceType)
    // permissions that apply to the requested resource type (e.g. project -> project.*)
    const resourceTypePermissions: readonly string[] = RESOURCE_TYPE_PERMISSIONS_MAP[resourceType]

    // from top level resource types (org) to child resource types (project), find a parent resource which
    // owns the read permission for the requested resource type.
    for (const parentResourceType of PARENT_RESOURCE_TYPE_MAP[resourceType]) {
      // find all resources of the parent resource type that the user has access to
      // AND have the read permission for the requested resource type.
      const parentPermissionsByParentId =
        await this.listDirectResourcePermissionsMatchingPermission(
          userId,
          parentResourceType,
          RESOURCE_TYPE_READ_PERMISSION_MAP[resourceType],
        )

      // we haven't found any parent resources that the user has access to
      // and have the read permission for the requested resource type.
      // No problem, let's move on to the next parent resource type (ex: org -> project if we were looking for agents)
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

        // union: inherited permissions add to (never replace) permissions from a direct role
        const directPermissions = permissionsByResourceId.get(resourceId) ?? []
        permissionsByResourceId.set(resourceId, [
          ...new Set([...directPermissions, ...inheritedPermissions]),
        ])
      }

      break
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

  private async listResourceIdsFromDirectAccess(
    userId: string,
    resourceType: PermissionResourceType,
  ): Promise<string[]> {
    const readPermission = RESOURCE_TYPE_READ_PERMISSION_MAP[resourceType]

    if (!readPermission) {
      return []
    }

    return this.listResourceIdsMatchingPermission(userId, resourceType, readPermission)
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

  // async listPermissionsForResourceIds(
  //   userId: string,
  //   resourceType: PermissionResourceType,
  //   resourceIds: string[],
  // ): Promise<Map<string, string[]>> {
  //   if (resourceIds.length === 0) {
  //     return new Map()
  //   }

  //   const rows: ResourcePermissionRow[] = await this.dataSource.query(
  //     `SELECT membership.resource_id AS "resourceId",
  //             role_permission.permission_key AS "permissionKey"
  //      FROM user_membership membership
  //      INNER JOIN role_permission ON role_permission.role_id = membership.role_id
  //      WHERE membership.user_id = $1
  //        AND membership.resource_type = $2
  //        AND membership.resource_id = ANY($3)
  //        AND membership.role_id IS NOT NULL
  //        AND membership.deleted_at IS NULL
  //      ORDER BY membership.resource_id, role_permission.permission_key`,
  //     [userId, resourceType, resourceIds],
  //   )

  //   return this.groupPermissionsByResourceId(rows)
  // }

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

  async has(userId: string, permission: string, resource: PermissionResource): Promise<boolean> {
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

  private groupPermissionsByResourceId(rows: ResourcePermissionRow[]): Map<string, string[]> {
    const permissionsByResourceId = new Map<string, string[]>()
    for (const row of rows) {
      const resourcePermissions = permissionsByResourceId.get(row.resourceId) ?? []
      resourcePermissions.push(row.permissionKey)
      permissionsByResourceId.set(row.resourceId, resourcePermissions)
    }

    return permissionsByResourceId
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

/** One declarative SQL query per (child resource type -> parent resource type) pair. */
const CHILD_RESOURCE_ROWS_QUERIES: Partial<
  Record<PermissionResourceType, Partial<Record<PermissionResourceType, string>>>
> = {
  project: {
    organization: `SELECT project.id AS "resourceId",
                          project.organization_id AS "parentResourceId"
                   FROM project
                   WHERE project.organization_id = ANY($1)
                     AND project.deleted_at IS NULL`,
  },
  agent: {
    organization: `SELECT agent.id AS "resourceId",
                          agent.organization_id AS "parentResourceId"
                   FROM agent
                   WHERE agent.organization_id = ANY($1)
                     AND agent.deleted_at IS NULL`,
    project: `SELECT agent.id AS "resourceId",
                     agent.project_id AS "parentResourceId"
              FROM agent
              WHERE agent.project_id = ANY($1)
                AND agent.deleted_at IS NULL`,
  },
}
