import type { MigrationInterface, QueryRunner } from "typeorm"

export class AddPublicChat1779364885428 implements MigrationInterface {
  name = "AddPublicChat1779364885428"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "public_agent_session" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "agent_id" uuid NOT NULL, "organization_id" uuid NOT NULL, "project_id" uuid NOT NULL, "session_token_hash" character varying NOT NULL, "external_visitor_id" character varying, "last_activity_at" TIMESTAMP, CONSTRAINT "UQ_a0f42b5154bdf08d3ea71b7eb14" UNIQUE ("session_token_hash"), CONSTRAINT "PK_edd2bf4ae6c8daee1329ddfcbc1" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_a0f42b5154bdf08d3ea71b7eb1" ON "public_agent_session" ("session_token_hash") `,
    )
    await queryRunner.query(
      `ALTER TABLE "agent" ADD "embed_token" uuid NOT NULL DEFAULT uuid_generate_v4()`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent" ADD CONSTRAINT "UQ_0c6c7fe6c36ad5f2156c808e06a" UNIQUE ("embed_token")`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent" ADD "embed_enabled" boolean NOT NULL DEFAULT false`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent" ADD "embed_allowed_origins" jsonb NOT NULL DEFAULT '[]'`,
    )
    await queryRunner.query(
      `ALTER TABLE "public_agent_session" ADD CONSTRAINT "FK_86a47df2323c27c4f38894c5752" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public_agent_session" DROP CONSTRAINT "FK_86a47df2323c27c4f38894c5752"`,
    )
    await queryRunner.query(`ALTER TABLE "agent" DROP COLUMN "embed_allowed_origins"`)
    await queryRunner.query(`ALTER TABLE "agent" DROP COLUMN "embed_enabled"`)
    await queryRunner.query(`ALTER TABLE "agent" DROP CONSTRAINT "UQ_0c6c7fe6c36ad5f2156c808e06a"`)
    await queryRunner.query(`ALTER TABLE "agent" DROP COLUMN "embed_token"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_a0f42b5154bdf08d3ea71b7eb1"`)
    await queryRunner.query(`DROP TABLE "public_agent_session"`)
  }
}
