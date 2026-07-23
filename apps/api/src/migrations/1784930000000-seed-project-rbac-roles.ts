import type { MigrationInterface, QueryRunner } from "typeorm"

const SEEDED_ROLE_KEYS_SQL = `'project_owner', 'project_admin', 'project_member'`

/**
 * Seeds the project-domain RBAC catalog and backfills project memberships.
 * Does not call Nest services — raw SQL only.
 * Mirrors SeedOrganizationRbacRoles1783955500000 for the project scope.
 */
export class SeedProjectRbacRoles1784930000000 implements MigrationInterface {
  name = "SeedProjectRbacRoles1784930000000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role" ("key", "name", "scope_type")
      VALUES
        ('project_owner', 'Project Owner', 'project'),
        ('project_admin', 'Project Admin', 'project'),
        ('project_member', 'Project Member', 'project')
      ON CONFLICT ("key") DO NOTHING
    `)

    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.permission_key
      FROM "role" AS role
      INNER JOIN (
        VALUES
          ('project_owner', 'project.read'),
          ('project_owner', 'project.update'),
          ('project_owner', 'project.delete'),
          ('project_owner', 'agent.create'),
          ('project_owner', 'agent.read'),
          ('project_admin', 'project.read'),
          ('project_admin', 'project.update'),
          ('project_admin', 'project.delete'),
          ('project_admin', 'agent.create'),
          ('project_admin', 'agent.read'),
          ('project_member', 'project.read')
      ) AS permission(role_key, permission_key)
        ON role.key = permission.role_key
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)

    await queryRunner.query(`
      UPDATE "user_membership" AS membership
      SET role_id = role.id
      FROM "role" AS role
      WHERE membership.resource_type = 'project'
        AND membership.role_id IS NULL
        AND membership.role = 'owner'
        AND role.key = 'project_owner'
    `)
    await queryRunner.query(`
      UPDATE "user_membership" AS membership
      SET role_id = role.id
      FROM "role" AS role
      WHERE membership.resource_type = 'project'
        AND membership.role_id IS NULL
        AND membership.role = 'admin'
        AND role.key = 'project_admin'
    `)
    await queryRunner.query(`
      UPDATE "user_membership" AS membership
      SET role_id = role.id
      FROM "role" AS role
      WHERE membership.resource_type = 'project'
        AND membership.role_id IS NULL
        AND membership.role = 'member'
        AND role.key = 'project_member'
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "user_membership" AS membership
      SET role_id = NULL
      FROM "role" AS role
      WHERE membership.role_id = role.id
        AND role.key IN (${SEEDED_ROLE_KEYS_SQL})
    `)

    await queryRunner.query(`
      DELETE FROM "role_permission" AS role_permission
      USING "role" AS role
      WHERE role_permission.role_id = role.id
        AND role.key IN (${SEEDED_ROLE_KEYS_SQL})
    `)

    await queryRunner.query(`DELETE FROM "role" WHERE key IN (${SEEDED_ROLE_KEYS_SQL})`)
  }
}
