import type { MigrationInterface, QueryRunner } from "typeorm"

export class PublicAgentSessionAppInstallation1791476850323 implements MigrationInterface {
  name = "PublicAgentSessionAppInstallation1791476850323"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "public_agent_session" ADD "app_installation_id" uuid`)
    await queryRunner.query(
      `ALTER TABLE "public_agent_session" DROP CONSTRAINT "FK_8e7d193c636f1106416e15372c2"`,
    )
    await queryRunner.query(
      `ALTER TABLE "public_agent_session" ALTER COLUMN "embed_config_id" DROP NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "public_agent_session" ALTER COLUMN "session_token_hash" DROP NOT NULL`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_b05a0998b4b257f543ab0240b5" ON "public_agent_session" ("app_installation_id") `,
    )
    await queryRunner.query(
      `ALTER TABLE "public_agent_session" ADD CONSTRAINT "CHK_public_agent_session_one_channel" CHECK (("embed_config_id" IS NULL) <> ("app_installation_id" IS NULL))`,
    )
    await queryRunner.query(
      `ALTER TABLE "public_agent_session" ADD CONSTRAINT "FK_8e7d193c636f1106416e15372c2" FOREIGN KEY ("embed_config_id") REFERENCES "agent_embed_config"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "public_agent_session" ADD CONSTRAINT "FK_b05a0998b4b257f543ab0240b5c" FOREIGN KEY ("app_installation_id") REFERENCES "app_installation"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "public_agent_session" DROP CONSTRAINT "FK_b05a0998b4b257f543ab0240b5c"`,
    )
    await queryRunner.query(
      `ALTER TABLE "public_agent_session" DROP CONSTRAINT "FK_8e7d193c636f1106416e15372c2"`,
    )
    await queryRunner.query(
      `ALTER TABLE "public_agent_session" DROP CONSTRAINT "CHK_public_agent_session_one_channel"`,
    )
    await queryRunner.query(`DROP INDEX "public"."IDX_b05a0998b4b257f543ab0240b5"`)
    await queryRunner.query(
      `ALTER TABLE "public_agent_session" ALTER COLUMN "session_token_hash" SET NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "public_agent_session" ALTER COLUMN "embed_config_id" SET NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "public_agent_session" ADD CONSTRAINT "FK_8e7d193c636f1106416e15372c2" FOREIGN KEY ("embed_config_id") REFERENCES "agent_embed_config"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    )
    await queryRunner.query(`ALTER TABLE "public_agent_session" DROP COLUMN "app_installation_id"`)
  }
}
