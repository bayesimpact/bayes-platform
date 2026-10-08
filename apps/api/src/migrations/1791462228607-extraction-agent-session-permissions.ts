import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Extraction sessions move to RBAC, with the same people the legacy session and document policies
 * let in: `agent.extraction.session.read`, `.create` and `.delete` (live runs) on every project
 * role, and `agent.extraction.session.playground.read`, `.create` and `.delete` on project
 * owner/admin only. No schema change, role_permission rows only.
 */
export class ExtractionAgentSessionPermissions1791462228607 implements MigrationInterface {
  name = "ExtractionAgentSessionPermissions1791462228607"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ('agent.extraction.session.read'),
          ('agent.extraction.session.create'),
          ('agent.extraction.session.delete')
      ) AS permission(key)
      WHERE role.key IN ('project_owner', 'project_admin', 'project_member')
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ('agent.extraction.session.playground.read'),
          ('agent.extraction.session.playground.create'),
          ('agent.extraction.session.playground.delete')
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
        AND role.key IN ('project_owner', 'project_admin', 'project_member')
        AND role_permission.permission_key IN (
          'agent.extraction.session.read',
          'agent.extraction.session.create',
          'agent.extraction.session.delete',
          'agent.extraction.session.playground.read',
          'agent.extraction.session.playground.create',
          'agent.extraction.session.playground.delete'
        )
    `)
  }
}
