import type { MigrationInterface, QueryRunner } from "typeorm"

export class AddEmbedConfigBannerText1788785187296 implements MigrationInterface {
  name = "AddEmbedConfigBannerText1788785187296"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_embed_config" ADD "banner_text" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_embed_config" DROP COLUMN "banner_text"`)
  }
}
