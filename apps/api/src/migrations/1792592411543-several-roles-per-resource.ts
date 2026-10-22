import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * A person can hold several roles on one resource, one `user_membership` row per role (ADR 0032):
 * - gives a `role_id` to the last rows that only had the legacy `role` string, the way
 *   `seed:rbac` did (campaign rows only for people still in the campaign's project);
 * - replaces the unique indexes on (user, resource) and, for campaigns, (user, resource, legacy
 *   role) with one on (user, resource type, resource, role_id);
 * - moves the `agent_conversation_reviewer` grants from `temp_agent` rows to plain `agent` rows;
 * - makes the legacy `role` column nullable: the code no longer reads or writes it.
 *
 * `down` puts back one row per person and resource outside campaigns: it keeps the highest of
 * owner, admin and member and deletes the other rows.
 */
export class SeveralRolesPerResource1792592411543 implements MigrationInterface {
  name = "SeveralRolesPerResource1792592411543"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "user_membership" AS membership
      SET "role_id" = role.id
      FROM "role" AS role
      WHERE membership.role_id IS NULL
        AND role.key = CASE membership.resource_type
          WHEN 'organization' THEN 'org_' || membership.role
          WHEN 'project' THEN 'project_' || membership.role
          WHEN 'agent' THEN 'agent_' || membership.role
          WHEN 'temp_agent' THEN 'agent_conversation_reviewer'
        END
    `)
    await queryRunner.query(`
      UPDATE "user_membership" AS membership
      SET "role_id" = role.id
      FROM "role" AS role
      WHERE membership.role_id IS NULL
        AND membership.resource_type = 'review_campaign'
        AND role.key = 'review_campaign_' || membership.role
        AND EXISTS (
          SELECT 1
          FROM "review_campaign"
          INNER JOIN "user_membership" AS project_membership
            ON project_membership.resource_id = review_campaign.project_id
            AND project_membership.resource_type = 'project'
            AND project_membership.deleted_at IS NULL
          WHERE review_campaign.id = membership.resource_id
            AND project_membership.user_id = membership.user_id
        )
    `)

    await queryRunner.query(`DROP INDEX "public"."UQ_user_membership_campaign"`)
    await queryRunner.query(`DROP INDEX "public"."UQ_user_membership_non_campaign"`)

    await queryRunner.query(`
      UPDATE "user_membership"
      SET "resource_type" = 'agent'
      WHERE "resource_type" = 'temp_agent'
    `)

    await queryRunner.query(`ALTER TABLE "user_membership" ALTER COLUMN "role" DROP NOT NULL`)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_user_membership_role" ON "user_membership" ("user_id", "resource_type", "resource_id", "role_id") WHERE "resource_type" <> 'global'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_user_membership_role"`)

    await queryRunner.query(`
      UPDATE "user_membership" AS membership
      SET "resource_type" = 'temp_agent'
      FROM "role" AS role
      WHERE role.id = membership.role_id
        AND role.key = 'agent_conversation_reviewer'
        AND membership.resource_type = 'agent'
    `)

    // The legacy string, from the role each row holds now.
    await queryRunner.query(`
      UPDATE "user_membership" AS membership
      SET "role" = CASE
        WHEN role.key IN ('org_owner', 'project_owner', 'agent_owner') THEN 'owner'
        WHEN role.key IN ('org_admin', 'project_admin', 'agent_admin') THEN 'admin'
        WHEN role.key = 'review_campaign_tester' THEN 'tester'
        WHEN role.key IN ('review_campaign_reviewer', 'agent_conversation_reviewer') THEN 'reviewer'
        ELSE 'member'
      END
      FROM "role" AS role
      WHERE role.id = membership.role_id
    `)
    await queryRunner.query(`UPDATE "user_membership" SET "role" = 'member' WHERE "role" IS NULL`)

    await queryRunner.query(`
      DELETE FROM "user_membership"
      WHERE "id" IN (
        SELECT ranked.id
        FROM (
          SELECT membership.id,
                 ROW_NUMBER() OVER (
                   PARTITION BY membership.user_id, membership.resource_type, membership.resource_id
                   ORDER BY CASE membership.role
                              WHEN 'owner' THEN 0
                              WHEN 'admin' THEN 1
                              ELSE 2
                            END,
                            membership.created_at,
                            membership.id
                 ) AS rank
          FROM "user_membership" AS membership
          WHERE membership.resource_type <> 'review_campaign'
        ) AS ranked
        WHERE ranked.rank > 1
      )
    `)
    await queryRunner.query(`
      DELETE FROM "user_membership"
      WHERE "id" IN (
        SELECT ranked.id
        FROM (
          SELECT membership.id,
                 ROW_NUMBER() OVER (
                   PARTITION BY membership.user_id, membership.resource_id, membership.role
                   ORDER BY membership.created_at, membership.id
                 ) AS rank
          FROM "user_membership" AS membership
          WHERE membership.resource_type = 'review_campaign'
        ) AS ranked
        WHERE ranked.rank > 1
      )
    `)

    await queryRunner.query(`ALTER TABLE "user_membership" ALTER COLUMN "role" SET NOT NULL`)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_user_membership_non_campaign" ON "user_membership" ("resource_id", "resource_type", "user_id") WHERE ((resource_type)::text <> 'review_campaign'::text)`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_user_membership_campaign" ON "user_membership" ("resource_id", "resource_type", "role", "user_id") WHERE ((resource_type)::text = 'review_campaign'::text)`,
    )
  }
}
