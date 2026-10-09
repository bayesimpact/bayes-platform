import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Document tags move to RBAC, with the same people the legacy guard let in:
 * `document_tag.read`, `.create`, `.update` and `.delete` on project owner/admin only.
 * No schema change, role_permission rows only.
 */
export class DocumentTagPermissions1791545296000 implements MigrationInterface {
  name = "DocumentTagPermissions1791545296000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (
        VALUES
          ('document_tag.read'),
          ('document_tag.create'),
          ('document_tag.update'),
          ('document_tag.delete')
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
          'document_tag.read',
          'document_tag.create',
          'document_tag.update',
          'document_tag.delete'
        )
    `)
  }
}
