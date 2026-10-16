import type { MigrationInterface, QueryRunner } from "typeorm"

export class AgentMemory1791204186984 implements MigrationInterface {
  name = "AgentMemory1791204186984"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "agent_memory" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "organization_id" uuid NOT NULL, "project_id" uuid NOT NULL, "agent_id" uuid NOT NULL, "user_id" uuid NOT NULL, "session_type" character varying NOT NULL, "content" text NOT NULL, "origin" character varying NOT NULL, "status" character varying NOT NULL, "source_session_id" uuid, CONSTRAINT "PK_d43006bd0306062da5c7aa3f00e" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_87a21ac317e5a439fe06a96668" ON "agent_memory" ("organization_id", "project_id", "agent_id", "user_id", "session_type") `,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_settings" ADD "memory_mode" character varying NOT NULL DEFAULT 'off'`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_memory" ADD CONSTRAINT "FK_d970b1f54fd3fc05f5717ae1c6a" FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_memory" ADD CONSTRAINT "FK_a33af4be8f7b6ba568d71ca8180" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_memory" DROP CONSTRAINT "FK_a33af4be8f7b6ba568d71ca8180"`,
    )
    await queryRunner.query(
      `ALTER TABLE "agent_memory" DROP CONSTRAINT "FK_d970b1f54fd3fc05f5717ae1c6a"`,
    )
    await queryRunner.query(`ALTER TABLE "agent_settings" DROP COLUMN "memory_mode"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_87a21ac317e5a439fe06a96668"`)
    await queryRunner.query(`DROP TABLE "agent_memory"`)
  }
}
