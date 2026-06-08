import type { MigrationInterface, QueryRunner } from "typeorm"

export class AgentEmbedConfigDisplayMode1780925599204 implements MigrationInterface {
  name = "AgentEmbedConfigDisplayMode1780925599204"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_embed_config" ADD "display_mode" character varying(20) NOT NULL DEFAULT 'modal'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "agent_embed_config" DROP COLUMN "display_mode"`)
  }
}
