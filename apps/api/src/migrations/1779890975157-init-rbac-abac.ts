import type { MigrationInterface, QueryRunner } from "typeorm"

export class InitRbacAbac1779890975157 implements MigrationInterface {
  name = "InitRbacAbac1779890975157"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "permission" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "action" character varying NOT NULL, "subject" character varying NOT NULL, "description" text, CONSTRAINT "UQ_permission_action_subject" UNIQUE ("action", "subject"), CONSTRAINT "PK_3b8b97af9d9d8807e41e6f48362" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE TABLE "role_permission" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "role_id" uuid NOT NULL, "permission_id" uuid NOT NULL, "conditions" jsonb, "fields" text array, "inverted" boolean NOT NULL DEFAULT false, "reason" text, CONSTRAINT "PK_96c8f1fd25538d3692024115b47" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_role_permission_permission" ON "role_permission" ("permission_id") `,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_role_permission_role" ON "role_permission" ("role_id") `,
    )
    await queryRunner.query(
      `CREATE TABLE "role" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "name" character varying NOT NULL, "description" text, "is_system" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_ae4578dcaed5adff96595e61660" UNIQUE ("name"), CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE TABLE "user_role" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "user_id" uuid NOT NULL, "role_id" uuid NOT NULL, "conditions" jsonb, CONSTRAINT "PK_fb2e442d14add3cefbdf33c4561" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(`CREATE INDEX "IDX_user_role_role" ON "user_role" ("role_id") `)
    await queryRunner.query(`CREATE INDEX "IDX_user_role_user" ON "user_role" ("user_id") `)

    // Expression indexes on the common scope keys in `conditions` for selectivity
    // matching the dropped per-membership indexes (organization_id, project_id, agent_id, campaign_id).
    await queryRunner.query(
      `CREATE INDEX "IDX_user_role_organization" ON "user_role" ((conditions ->> 'organizationId'))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_user_role_project" ON "user_role" ((conditions ->> 'projectId'))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_user_role_agent" ON "user_role" ((conditions ->> 'agentId'))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_user_role_campaign" ON "user_role" ((conditions ->> 'campaignId'))`,
    )

    // Add `attributes` to user table. Done in 3 steps to safely backfill existing rows:
    // 1) add nullable, 2) backfill empty object, 3) set NOT NULL.
    // No Postgres default — TypeORM treats JSONB defaults as drift; see migration 1776954669825-drop-jsonb-defaults.
    await queryRunner.query(`ALTER TABLE "user" ADD "attributes" jsonb`)
    await queryRunner.query(
      `UPDATE "user" SET "attributes" = '{}'::jsonb WHERE "attributes" IS NULL`,
    )
    await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "attributes" SET NOT NULL`)

    await queryRunner.query(
      `ALTER TABLE "role_permission" ADD CONSTRAINT "FK_3d0a7155eafd75ddba5a7013368" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "role_permission" ADD CONSTRAINT "FK_e3a3ba47b7ca00fd23be4ebd6cf" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "user_role" ADD CONSTRAINT "FK_d0e5815877f7395a198a4cb0a46" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "user_role" ADD CONSTRAINT "FK_32a6fc2fcb019d8e3a8ace0f55f" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_role" DROP CONSTRAINT "FK_32a6fc2fcb019d8e3a8ace0f55f"`,
    )
    await queryRunner.query(
      `ALTER TABLE "user_role" DROP CONSTRAINT "FK_d0e5815877f7395a198a4cb0a46"`,
    )
    await queryRunner.query(
      `ALTER TABLE "role_permission" DROP CONSTRAINT "FK_e3a3ba47b7ca00fd23be4ebd6cf"`,
    )
    await queryRunner.query(
      `ALTER TABLE "role_permission" DROP CONSTRAINT "FK_3d0a7155eafd75ddba5a7013368"`,
    )
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "attributes"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_user_role_campaign"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_user_role_agent"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_user_role_project"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_user_role_organization"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_user_role_user"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_user_role_role"`)
    await queryRunner.query(`DROP TABLE "user_role"`)
    await queryRunner.query(`DROP TABLE "role"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_role_permission_role"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_role_permission_permission"`)
    await queryRunner.query(`DROP TABLE "role_permission"`)
    await queryRunner.query(`DROP TABLE "permission"`)
  }
}
