import type { MigrationInterface, QueryRunner } from "typeorm"

export class AddEmbedConfigBranding1779454704114 implements MigrationInterface {
  name = "AddEmbedConfigBranding1779454704114"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_embed_config" ADD "title" text`)
    await queryRunner.query(`ALTER TABLE "agent_embed_config" ADD "logo_url" text`)
    await queryRunner.query(
      `ALTER TABLE "agent_embed_config" ADD "primary_color" character varying(20)`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_embed_config" DROP COLUMN "primary_color"`)
    await queryRunner.query(`ALTER TABLE "agent_embed_config" DROP COLUMN "logo_url"`)
    await queryRunner.query(`ALTER TABLE "agent_embed_config" DROP COLUMN "title"`)
  }
}
