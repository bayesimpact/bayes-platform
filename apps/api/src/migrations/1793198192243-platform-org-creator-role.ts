import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Creates the global `platform_org_creator` role, which only creates organizations from the
 * backoffice (`backoffice.read` + `organization.create`), and grants
 * `backoffice.global_role.update` to `platform_superadmin` so a superadmin can give or take a
 * global role from the backoffice user page.
 */
export class PlatformOrgCreatorRole1793198192243 implements MigrationInterface {
  name = "PlatformOrgCreatorRole1793198192243"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role" ("key", "name", "scope_type")
      SELECT 'platform_org_creator', 'Platform Organization Creator', 'global'
      WHERE NOT EXISTS (SELECT 1 FROM "role" WHERE "key" = 'platform_org_creator')
    `)

    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.key
      FROM "role" AS role
      CROSS JOIN (VALUES ('backoffice.read'), ('organization.create')) AS permission(key)
      WHERE role.key = 'platform_org_creator'
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)

    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, 'backoffice.global_role.update'
      FROM "role" AS role
      WHERE role.key = 'platform_superadmin'
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key = 'platform_superadmin'
        AND role_permission.permission_key = 'backoffice.global_role.update'
    `)

    await queryRunner.query(`
      DELETE FROM "user_membership" AS membership
      USING "role" AS role
      WHERE membership.role_id = role.id
        AND role.key = 'platform_org_creator'
    `)

    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key = 'platform_org_creator'
    `)

    await queryRunner.query(`DELETE FROM "role" WHERE "key" = 'platform_org_creator'`)
  }
}
