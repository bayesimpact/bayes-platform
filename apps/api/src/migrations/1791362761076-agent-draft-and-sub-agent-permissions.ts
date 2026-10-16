import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Agents move to RBAC: `agent.draft.read` on project owner/admin, and
 * `agent.sub_agent.read` / `agent.sub_agent.update` on agent owner/admin. Members of
 * a project no longer list agent drafts; sub-agents keep the people the legacy agent
 * policy let in. No schema change — role_permission rows only.
 */
export class AgentDraftAndSubAgentPermissions1791362761076 implements MigrationInterface {
  name = "AgentDraftAndSubAgentPermissions1791362761076"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'agent.draft.read'
      FROM "role" AS role
      WHERE role.key IN ('project_owner', 'project_admin')
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)

    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (VALUES ('agent.sub_agent.read'), ('agent.sub_agent.update')) AS permission(key)
      WHERE role.key IN ('agent_owner', 'agent_admin')
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key IN ('project_owner', 'project_admin')
        AND role_permission.permission_key = 'agent.draft.read'
    `)

    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key IN ('agent_owner', 'agent_admin')
        AND role_permission.permission_key IN ('agent.sub_agent.read', 'agent.sub_agent.update')
    `)
  }
}
