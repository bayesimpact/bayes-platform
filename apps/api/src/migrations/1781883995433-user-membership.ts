import type { MigrationInterface, QueryRunner } from "typeorm"

export class UserMembership1781883995433 implements MigrationInterface {
  name = "UserMembership1781883995433"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_membership" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "user_id" uuid NOT NULL, "resource_type" character varying NOT NULL, "resource_id" uuid NOT NULL, "role" character varying NOT NULL, CONSTRAINT "PK_user_membership_id" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_user_membership_campaign" ON "user_membership" ("user_id", "resource_id", "resource_type", "role") WHERE "resource_type" = 'review_campaign'`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_user_membership_non_campaign" ON "user_membership" ("user_id", "resource_id", "resource_type") WHERE "resource_type" <> 'review_campaign'`,
    )
    await queryRunner.query(
      `ALTER TABLE "user_membership" ADD CONSTRAINT "FK_13c0b9b73e272c78393908bfe31" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )

    // Backfill from organization_membership
    await queryRunner.query(`
      INSERT INTO "user_membership" ("id", "created_at", "updated_at", "deleted_at", "user_id", "resource_type", "resource_id", "role")
      SELECT id, created_at, updated_at, deleted_at, user_id, 'organization', organization_id, role
      FROM "organization_membership"
      ON CONFLICT DO NOTHING
    `)

    // Backfill from project_membership
    await queryRunner.query(`
      INSERT INTO "user_membership" ("id", "created_at", "updated_at", "deleted_at", "user_id", "resource_type", "resource_id", "role")
      SELECT id, created_at, updated_at, deleted_at, user_id, 'project', project_id, role
      FROM "project_membership"
      ON CONFLICT DO NOTHING
    `)

    // Backfill from agent_membership
    await queryRunner.query(`
      INSERT INTO "user_membership" ("id", "created_at", "updated_at", "deleted_at", "user_id", "resource_type", "resource_id", "role")
      SELECT id, created_at, updated_at, deleted_at, user_id, 'agent', agent_id, role
      FROM "agent_membership"
      ON CONFLICT DO NOTHING
    `)

    // Backfill from review_campaign_membership
    await queryRunner.query(`
      INSERT INTO "user_membership" ("id", "created_at", "updated_at", "deleted_at", "user_id", "resource_type", "resource_id", "role")
      SELECT id, created_at, updated_at, deleted_at, user_id, 'review_campaign', campaign_id, role
      FROM "review_campaign_membership"
      ON CONFLICT DO NOTHING
    `)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_membership" DROP CONSTRAINT "FK_13c0b9b73e272c78393908bfe31"`,
    )
    await queryRunner.query(`DROP INDEX "public"."UQ_user_membership_non_campaign"`)
    await queryRunner.query(`DROP INDEX "public"."UQ_user_membership_campaign"`)
    await queryRunner.query(`DROP TABLE "user_membership"`)
  }
}
