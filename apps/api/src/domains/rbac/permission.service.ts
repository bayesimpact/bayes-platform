import { Injectable } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource } from "typeorm"
import type { PermissionResource } from "./permission.types"

@Injectable()
export class PermissionService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async hasGlobal(userId: string, permission: string): Promise<boolean> {
    const matches: { allowed: number }[] = await this.dataSource.query(
      `SELECT 1 AS allowed
       FROM user_membership membership
       INNER JOIN role_permission role_permission ON role_permission.role_id = membership.role_id
       INNER JOIN permission ON permission.id = role_permission.permission_id
       WHERE membership.user_id = $1
         AND membership.resource_type = 'global'
         AND membership.resource_id IS NULL
         AND membership.role_id IS NOT NULL
         AND membership.deleted_at IS NULL
         AND permission.key = $2
       LIMIT 1`,
      [userId, permission],
    )

    return matches.length > 0
  }

  async has(userId: string, permission: string, resource: PermissionResource): Promise<boolean> {
    const matches: { allowed: number }[] = await this.dataSource.query(
      `SELECT 1 AS allowed
       FROM user_membership membership
       INNER JOIN role_permission role_permission ON role_permission.role_id = membership.role_id
       INNER JOIN permission ON permission.id = role_permission.permission_id
       WHERE membership.user_id = $1
         AND membership.resource_type = $2
         AND membership.resource_id = $3
         AND membership.role_id IS NOT NULL
         AND membership.deleted_at IS NULL
         AND permission.key = $4
       LIMIT 1`,
      [userId, resource.type, resource.id, permission],
    )

    return matches.length > 0
  }
}
