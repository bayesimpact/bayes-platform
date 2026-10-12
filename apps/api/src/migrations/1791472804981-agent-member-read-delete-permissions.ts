import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Agent memberships move to RBAC: `agent.member.read` and `agent.member.delete` on
 * agent owner/admin only, like `agent.member.invite`.
 * No schema change, role_permission rows only.
 */
export class AgentMemberReadDeletePermissions1791472804981 implements MigrationInterface {
  name = "AgentMemberReadDeletePermissions1791472804981"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ('agent.member.read'),
          ('agent.member.delete')
      ) AS permission(key)
      WHERE role.key IN ('agent_owner', 'agent_admin')
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key IN ('agent_owner', 'agent_admin')
        AND role_permission.permission_key IN ('agent.member.read', 'agent.member.delete')
    `)
  }
}
