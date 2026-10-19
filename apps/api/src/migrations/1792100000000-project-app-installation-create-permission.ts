import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Project owners and admins can install apps on their project through the consent page of the
 * OAuth server (ADR 0029): `project.app_installation.create` on project owner/admin only.
 * No schema change, role_permission rows only.
 */
export class ProjectAppInstallationCreatePermission1792100000000 implements MigrationInterface {
  name = "ProjectAppInstallationCreatePermission1792100000000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'project.app_installation.create'
      FROM "role" AS role
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
        AND role_permission.permission_key = 'project.app_installation.create'
    `)
  }
}
