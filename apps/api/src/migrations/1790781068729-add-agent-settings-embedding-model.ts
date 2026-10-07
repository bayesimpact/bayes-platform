import type { MigrationInterface, QueryRunner } from "typeorm"

export class AddAgentSettingsEmbeddingModel1790781068729 implements MigrationInterface {
  name = "AddAgentSettingsEmbeddingModel1790781068729"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_settings" ADD "embedding_model" character varying`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_settings" DROP COLUMN "embedding_model"`)
  }
}
