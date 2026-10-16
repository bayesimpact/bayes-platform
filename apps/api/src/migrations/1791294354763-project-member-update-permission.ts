import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * `project.member.update` on project owner/admin: they can switch another member's
 * project role between admin and member. No schema change, role_permission rows only.
 */
export class ProjectMemberUpdatePermission1791294354763 implements MigrationInterface {
  name = "ProjectMemberUpdatePermission1791294354763"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'project.member.update'
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
        AND role_permission.permission_key = 'project.member.update'
    `)
  }
}
