import type { MigrationInterface, QueryRunner } from "typeorm"

export class AddPublicChat1779371023472 implements MigrationInterface {
  name = "AddPublicChat1779371023472"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "agent_embed_config" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "organization_id" uuid NOT NULL, "project_id" uuid NOT NULL, "agent_id" uuid NOT NULL, "embed_token" uuid NOT NULL, "is_enabled" boolean NOT NULL DEFAULT false, "allowed_origins" jsonb NOT NULL DEFAULT '[]', CONSTRAINT "UQ_e638ba1a389ac34ef05198c6330" UNIQUE ("agent_id"), CONSTRAINT "UQ_9d8a3b72e027a462a3607104e08" UNIQUE ("embed_token"), CONSTRAINT "PK_c9414fced3e95caec466c9e0982" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_64392316ec3940fc1193db9d14" ON "agent_embed_config" ("organization_id", "project_id", "agent_id") `,
    )

    await queryRunner.query(
      `CREATE TABLE "public_agent_session" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "embed_config_id" uuid NOT NULL, "agent_id" uuid NOT NULL, "organization_id" uuid NOT NULL, "project_id" uuid NOT NULL, "session_token_hash" character varying NOT NULL, "external_visitor_id" character varying, "last_activity_at" TIMESTAMP, CONSTRAINT "UQ_a0f42b5154bdf08d3ea71b7eb14" UNIQUE ("session_token_hash"), CONSTRAINT "PK_edd2bf4ae6c8daee1329ddfcbc1" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_a0f42b5154bdf08d3ea71b7eb1" ON "public_agent_session" ("session_token_hash") `,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_embed_config" ADD CONSTRAINT "FK_e638ba1a389ac34ef05198c6330" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "public_agent_session" ADD CONSTRAINT "FK_8e7d193c636f1106416e15372c2" FOREIGN KEY ("embed_config_id") REFERENCES "agent_embed_config"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public_agent_session" DROP CONSTRAINT "FK_8e7d193c636f1106416e15372c2"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_embed_config" DROP CONSTRAINT "FK_e638ba1a389ac34ef05198c6330"`,
    )
    await queryRunner.query(`DROP INDEX "public"."IDX_a0f42b5154bdf08d3ea71b7eb1"`)
    await queryRunner.query(`DROP TABLE "public_agent_session"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_64392316ec3940fc1193db9d14"`)
    await queryRunner.query(`DROP TABLE "agent_embed_config"`)
  }
}
