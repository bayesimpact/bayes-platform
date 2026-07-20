import type { MigrationInterface, QueryRunner } from "typeorm"

const SEEDED_ROLE_KEYS_SQL = `'org_owner', 'org_admin', 'org_member', 'org_creator'`

/**
 * Seeds the organization-domain RBAC catalog and backfills memberships.
 * Does not call Nest services — raw SQL only.
 *
 * Org-creator grants use ORGANIZATION_CREATOR_EMAIL_DOMAIN when set; otherwise skipped.
 */
export class SeedOrganizationRbacRoles1783955500000 implements MigrationInterface {
  name = "SeedOrganizationRbacRoles1783955500000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "role" ("key", "name", "scope_type")
      VALUES
        ('org_owner', 'Organization Owner', 'organization'),
        ('org_admin', 'Organization Admin', 'organization'),
        ('org_member', 'Organization Member', 'organization'),
        ('org_creator', 'Organization Creator', 'global')
      ON CONFLICT ("key") DO NOTHING
    `)

    await queryRunner.query(`
      INSERT INTO "role_permission" ("role_id", "permission_key")
      SELECT role.id, permission.permission_key
      FROM "role" AS role
      INNER JOIN (
        VALUES
          ('org_owner', 'organization.read'),
          ('org_owner', 'organization.update'),
          ('org_owner', 'organization.delete'),
          ('org_owner', 'project.create'),
          ('org_owner', 'project.read'),
          ('org_admin', 'organization.read'),
          ('org_admin', 'organization.update'),
          ('org_admin', 'project.create'),
          ('org_admin', 'project.read'),
          ('org_member', 'organization.read'),
          ('org_creator', 'organization.create')
      ) AS permission(role_key, permission_key)
        ON role.key = permission.role_key
      ON CONFLICT ("role_id", "permission_key") DO NOTHING
    `)

    await queryRunner.query(`
      UPDATE "user_membership" AS membership
      SET role_id = role.id
      FROM "role" AS role
      WHERE membership.resource_type = 'organization'
        AND membership.role_id IS NULL
        AND membership.role = 'owner'
        AND role.key = 'org_owner'
    `)
    await queryRunner.query(`
      UPDATE "user_membership" AS membership
      SET role_id = role.id
      FROM "role" AS role
      WHERE membership.resource_type = 'organization'
        AND membership.role_id IS NULL
        AND membership.role = 'admin'
        AND role.key = 'org_admin'
    `)
    await queryRunner.query(`
      UPDATE "user_membership" AS membership
      SET role_id = role.id
      FROM "role" AS role
      WHERE membership.resource_type = 'organization'
        AND membership.role_id IS NULL
        AND membership.role = 'member'
        AND role.key = 'org_member'
    `)

    const allowedDomain = process.env.ORGANIZATION_CREATOR_EMAIL_DOMAIN?.trim()
    if (!allowedDomain) {
      return
    }

    await queryRunner.query(
      `
      INSERT INTO "user_membership" ("user_id", "resource_type", "resource_id", "role", "role_id")
      SELECT user_account.id, 'global', NULL, 'member', role.id
      FROM "user" AS user_account
      CROSS JOIN "role" AS role
      WHERE role.key = 'org_creator'
        AND lower(trim(user_account.email)) LIKE '%' || lower(trim($1))
        AND user_account.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "user_membership" AS membership
          WHERE membership.user_id = user_account.id
            AND membership.resource_type = 'global'
            AND membership.role_id = role.id
            AND membership.deleted_at IS NULL
        )
      `,
      [allowedDomain],
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "user_membership" AS membership
      USING "role" AS role
      WHERE membership.resource_type = 'global'
        AND membership.role_id = role.id
        AND role.key = 'org_creator'
    `)

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
