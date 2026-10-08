import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Session categories move to RBAC, with the same people the legacy policy let in:
 * `project.agent_session_category.create` and `.delete` on project owner/admin only.
 * No schema change, role_permission rows only.
 */
export class ProjectAgentSessionCategoryPermissions1791464018300 implements MigrationInterface {
  name = "ProjectAgentSessionCategoryPermissions1791464018300"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ('project.agent_session_category.create'),
          ('project.agent_session_category.delete')
      ) AS permission(key)
      WHERE role.key IN ('project_owner', 'project_admin')
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key IN ('project_owner', 'project_admin')
        AND role_permission.permission_key IN (
          'project.agent_session_category.create',
          'project.agent_session_category.delete'
        )
    `)
  }
}
