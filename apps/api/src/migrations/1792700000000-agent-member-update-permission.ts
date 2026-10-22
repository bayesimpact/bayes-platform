import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Changing a member's roles on an agent: `agent.member.update` on agent owner/admin, the people
 * who already invite to the agent and remove its members. No schema change — role_permission rows
 * only.
 */
export class AgentMemberUpdatePermission1792700000000 implements MigrationInterface {
  name = "AgentMemberUpdatePermission1792700000000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'agent.member.update'
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
        AND role_permission.permission_key = 'agent.member.update'
    `)
  }
}
