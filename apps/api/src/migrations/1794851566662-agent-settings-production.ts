import type { MigrationInterface, QueryRunner } from "typeorm"

export class AgentSettingsProduction1794851566662 implements MigrationInterface {
  name = "AgentSettingsProduction1794851566662"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "agent_settings" ADD "is_production" boolean NOT NULL DEFAULT false`,
    )
    // Until now production was implicit: the newest saved, non-archived revision. Mark it, so
    // every agent keeps running the version it ran before.
    await queryRunner.query(`
      UPDATE "agent_settings" SET "is_production" = true
      WHERE "id" IN (
        SELECT DISTINCT ON ("agent_id") "id" FROM "agent_settings"
        WHERE "is_draft" = false AND "is_archived" = false AND "deleted_at" IS NULL
        ORDER BY "agent_id", "revision" DESC
      )
    `)
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_agent_settings_production" ON "agent_settings" ("agent_id") WHERE "is_production" = true AND "deleted_at" IS NULL`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_agent_settings_production"`)
    await queryRunner.query(`ALTER TABLE "agent_settings" DROP COLUMN "is_production"`)
  }
}
