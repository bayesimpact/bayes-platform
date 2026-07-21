import { Injectable } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource } from "typeorm"
import type { PermissionResource, PermissionResourceType } from "./permission.types"

type PermissionRow = { permissionKey: string }
type ResourcePermissionRow = { resourceId: string; permissionKey: string }
type ResourceIdRow = { resourceId: string }

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

  async listResourceIds(userId: string, resourceType: PermissionResourceType): Promise<string[]> {
    const requiresRoleId = resourceType === "organization"
    const rows: ResourceIdRow[] = await this.dataSource.query(
      `SELECT DISTINCT membership.resource_id AS "resourceId"
       FROM user_membership membership
       WHERE membership.user_id = $1
         AND membership.resource_type = $2
         AND membership.resource_id IS NOT NULL
         ${requiresRoleId ? "AND membership.role_id IS NOT NULL" : ""}
         AND membership.deleted_at IS NULL
       ORDER BY membership.resource_id`,
      [userId, resourceType],
    )

    return rows.map((row) => row.resourceId)
  }

  async listPermissionsForResourceIds(
    userId: string,
    resourceType: PermissionResourceType,
    resourceIds: string[],
  ): Promise<Map<string, string[]>> {
    if (resourceIds.length === 0) {
      return new Map()
    }

    const rows: ResourcePermissionRow[] = await this.dataSource.query(
      `SELECT membership.resource_id AS "resourceId",
              role_permission.permission_key AS "permissionKey"
       FROM user_membership membership
       INNER JOIN role_permission ON role_permission.role_id = membership.role_id
       WHERE membership.user_id = $1
         AND membership.resource_type = $2
         AND membership.resource_id = ANY($3)
         AND membership.role_id IS NOT NULL
         AND membership.deleted_at IS NULL
       ORDER BY membership.resource_id, role_permission.permission_key`,
      [userId, resourceType, resourceIds],
    )

    return this.groupPermissionsByResourceId(rows)
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
}
