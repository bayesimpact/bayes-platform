import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Duplicating an agent: `agent.duplicate` on agent owner/admin, the people who
 * already see and change its sub-agents. No schema change — role_permission rows only.
 */
export class AgentDuplicatePermission1792414582110 implements MigrationInterface {
  name = "AgentDuplicatePermission1792414582110"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'agent.duplicate'
      FROM "role" AS role
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
        AND role_permission.permission_key = 'agent.duplicate'
    `)
  }
}
