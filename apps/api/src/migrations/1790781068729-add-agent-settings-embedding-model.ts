import type { MigrationInterface, QueryRunner } from "typeorm"

export class AddAgentSettingsEmbeddingModel1790781068729 implements MigrationInterface {
  name = "AddAgentSettingsEmbeddingModel1790781068729"

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Existing agents get the model their vectors were written with: a constant default fills
    // every row at once, without rewriting the table.
    await queryRunner.query(
      `ALTER TABLE "agent_settings" ADD "embedding_model" character varying NOT NULL DEFAULT 'gemini-embedding-001'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_settings" DROP COLUMN "embedding_model"`)
  }
}
