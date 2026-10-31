import { Injectable } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { TransactionService } from "@/common/transaction/transaction.service"
import { AGENT_CONVERSATION_REVIEWER_ROLE } from "@/domains/rbac/rbac.constants"

const AGENT_RESOURCE_TYPE = "agent" as const

export type AgentConversationReviewerRecord = {
  userId: string
  email: string
  name: string | null
  grantedAt: Date
}

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
 * Grants of the `agent_conversation_reviewer` role: `role_grant` rows on the agent, next to
 * the person's owner, admin or member row there if any. The unique index on (user, resource
 * type, resource id, role) keeps one grant per person and agent.
 *
 * Raw SQL, like PlatformRoleRepository: the membership and role tables belong to other domains.
 * Participates in the ambient transaction via TransactionService.getManager().
 */
@Injectable()
export class AgentConversationReviewerRepository {
  constructor(private readonly transactionService: TransactionService) {}

  async listAgentIdsForUser(userId: string): Promise<string[]> {
    const rows: { agentId: string }[] = await this.transactionService.getManager().query(
      `SELECT membership.resource_id AS "agentId"
       FROM "role_grant" AS membership
       INNER JOIN "role" AS role ON role.id = membership.role_id
       WHERE membership.user_id = $1
         AND membership.resource_type = $2
         AND role.key = $3
         AND membership.deleted_at IS NULL`,
      [userId, AGENT_RESOURCE_TYPE, AGENT_CONVERSATION_REVIEWER_ROLE],
    )
    return rows.map((row) => row.agentId)
  }

  /** The reviewers of one agent, by email. */
  async listReviewersOfAgent(agentId: string): Promise<AgentConversationReviewerRecord[]> {
    return this.transactionService.getManager().query(
      `SELECT membership.user_id AS "userId",
              "user".email AS "email",
              "user".name AS "name",
              membership.created_at AS "grantedAt"
       FROM "role_grant" AS membership
       INNER JOIN "role" AS role ON role.id = membership.role_id
       INNER JOIN "user" ON "user".id = membership.user_id
       WHERE membership.resource_type = $1
         AND membership.resource_id = $2
         AND role.key = $3
         AND membership.deleted_at IS NULL
       ORDER BY LOWER("user".email)`,
      [AGENT_RESOURCE_TYPE, agentId, AGENT_CONVERSATION_REVIEWER_ROLE],
    )
  }

  /** Returns true when the role was granted, false when the user already had it. */
  async grant({ userId, agentId }: { userId: string; agentId: string }): Promise<boolean> {
    const result: unknown = await this.transactionService.getManager().query(
      `INSERT INTO "role_grant" ("user_id", "resource_type", "resource_id", "role_id")
       SELECT $1, $2, $3, role.id
       FROM "role" AS role
       WHERE role.key = $4
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [userId, AGENT_RESOURCE_TYPE, agentId, AGENT_CONVERSATION_REVIEWER_ROLE],
    )
    return affectedRows(result) > 0
  }

  /**
   * Returns true when the role was revoked, false when the user did not have it. Hard delete:
   * the unique index ignores `deleted_at`, so a soft-deleted row would block a later grant.
   */
  async revoke({ userId, agentId }: { userId: string; agentId: string }): Promise<boolean> {
    const result: unknown = await this.transactionService.getManager().query(
      `DELETE FROM "role_grant" AS membership
       USING "role" AS role
       WHERE role.id = membership.role_id
         AND role.key = $4
         AND membership.user_id = $1
         AND membership.resource_type = $2
         AND membership.resource_id = $3
       RETURNING membership.id`,
      [userId, AGENT_RESOURCE_TYPE, agentId, AGENT_CONVERSATION_REVIEWER_ROLE],
    )
    return affectedRows(result) > 0
  }
}
