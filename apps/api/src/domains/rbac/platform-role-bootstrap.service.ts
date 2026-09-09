import { Injectable, Logger } from "@nestjs/common"
import { InjectDataSource } from "@nestjs/typeorm"
import type { DataSource } from "typeorm"
import { type PlatformRoleKey, resolveBootstrapRoles } from "./platform-role-bootstrap"

type UserIdentity = { id: string; email: string }

/**
 * TypeORM's raw query returns the rows for SELECT and INSERT ... RETURNING,
 * but a [rows, affectedCount] pair for UPDATE and DELETE.
 */
function affectedRows(result: unknown): number {
  if (Array.isArray(result) && result.length === 2 && typeof result[1] === "number") {
    return result[1]
  }
  return Array.isArray(result) ? result.length : 0
}

/**
 * Grants and revokes the global roles (platform_superadmin, platform_staff).
 *
 * ensureGlobalRolesForUser runs at every sign-in: the roles promised by
 * BACKOFFICE_AUTHORIZED_EMAILS and ORGANIZATION_CREATOR_EMAIL_DOMAIN are
 * granted when missing. This is what makes a fresh install usable: the seed
 * migrations only reach users that exist when they run, so the first
 * administrator would otherwise have no role at all.
 *
 * grantGlobalRole / revokeGlobalRole serve the administration command
 * (scripts/platform-role.ts) and, later, the back office.
 */
@Injectable()
export class PlatformRoleBootstrapService {
  private readonly logger = new Logger(PlatformRoleBootstrapService.name)
  /** user id + role key already checked in this process: one query per user, not per request. */
  private readonly ensured = new Set<string>()

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async ensureGlobalRolesForUser(user: UserIdentity): Promise<void> {
    const roles = resolveBootstrapRoles(user.email)
    for (const roleKey of roles) {
      const cacheKey = `${user.id}:${roleKey}`
      if (this.ensured.has(cacheKey)) continue
      const granted = await this.grantGlobalRole(user.id, roleKey)
      if (granted) {
        this.logger.log(`Granted ${roleKey} to ${user.email} (bootstrap from configuration)`)
      }
      this.ensured.add(cacheKey)
    }
  }

  /** Returns true when a membership was created, false when it already existed. */
  async grantGlobalRole(userId: string, roleKey: PlatformRoleKey): Promise<boolean> {
    const result: unknown = await this.dataSource.query(
      `INSERT INTO "user_membership" ("user_id", "resource_type", "resource_id", "role", "role_id")
       SELECT $1, 'global', NULL, 'member', role.id
       FROM "role" AS role
       WHERE role.key = $2
         AND NOT EXISTS (
           SELECT 1
           FROM "user_membership" AS membership
           WHERE membership.user_id = $1
             AND membership.resource_type = 'global'
             AND membership.role_id = role.id
             AND membership.deleted_at IS NULL
         )
       RETURNING id`,
      [userId, roleKey],
    )
    return affectedRows(result) > 0
  }

  /** Returns true when a membership was revoked, false when there was none. */
  async revokeGlobalRole(userId: string, roleKey: PlatformRoleKey): Promise<boolean> {
    const result: unknown = await this.dataSource.query(
      `UPDATE "user_membership" AS membership
       SET "deleted_at" = NOW()
       FROM "role" AS role
       WHERE role.id = membership.role_id
         AND role.key = $2
         AND membership.user_id = $1
         AND membership.resource_type = 'global'
         AND membership.deleted_at IS NULL
       RETURNING membership.id`,
      [userId, roleKey],
    )
    return affectedRows(result) > 0
  }

  async listGlobalRoles(userId: string): Promise<string[]> {
    const rows: { roleKey: string }[] = await this.dataSource.query(
      `SELECT role.key AS "roleKey"
       FROM "user_membership" AS membership
       INNER JOIN "role" AS role ON role.id = membership.role_id
       WHERE membership.user_id = $1
         AND membership.resource_type = 'global'
         AND membership.deleted_at IS NULL
       ORDER BY role.key`,
      [userId],
    )
    return rows.map((row) => row.roleKey)
  }
}
