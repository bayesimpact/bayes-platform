import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import type { PLATFORM_STAFF_ROLE, PLATFORM_SUPERADMIN_ROLE } from "./rbac.constants"

export type PlatformRoleKey = typeof PLATFORM_STAFF_ROLE | typeof PLATFORM_SUPERADMIN_ROLE

/**
 * TypeORM's raw query returns the rows for SELECT and INSERT ... RETURNING,
 * but a [rows, affectedCount] pair for DELETE and UPDATE.
 */
function affectedRows(result: unknown): number {
  if (Array.isArray(result) && result.length === 2 && typeof result[1] === "number") {
    return result[1]
  }
  return Array.isArray(result) ? result.length : 0
}

/**
 * Persistence of the global memberships (`user_membership` rows with
 * resource_type = 'global', one per user and platform role).
 *
 * Participates in the ambient transaction via TransactionService.getManager().
 */
@Injectable()
export class PlatformRoleRepository {
  constructor(private readonly transactionService: TransactionService) {}

  /** Returns true when a membership was created, false when it already existed. */
  async grantGlobalRole(userId: string, roleKey: PlatformRoleKey): Promise<boolean> {
    const result: unknown = await this.transactionService.getManager().query(
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

  /**
   * Returns true when a membership was revoked, false when there was none.
   * Hard delete, like UserMembershipRepository.deleteMembership: the unique
   * index on (user, role) for global memberships ignores deleted_at, so a
   * soft-deleted row would block a later grant.
   */
  async revokeGlobalRole(userId: string, roleKey: PlatformRoleKey): Promise<boolean> {
    const result: unknown = await this.transactionService.getManager().query(
      `DELETE FROM "user_membership" AS membership
       USING "role" AS role
       WHERE role.id = membership.role_id
         AND role.key = $2
         AND membership.user_id = $1
         AND membership.resource_type = 'global'
       RETURNING membership.id`,
      [userId, roleKey],
    )
    return affectedRows(result) > 0
  }

  /** Keys of the global roles held by the user, sorted. */
  async listGlobalRoleKeys(userId: string): Promise<string[]> {
    const rows: { roleKey: string }[] = await this.transactionService.getManager().query(
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
