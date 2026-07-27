import type { MigrationInterface, QueryRunner } from "typeorm"

export class ConversationRetentionDefault30d1785170477400 implements MigrationInterface {
  name = "ConversationRetentionDefault30d1785170477400"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project" ALTER COLUMN "conversation_retention_days" SET DEFAULT '30'`,
    )
    // Backfill: every existing project moves to the 30-day default. Projects
    // that must keep conversations forever opt out explicitly (null) in
    // their workspace settings afterwards. Not reverted by down() — we
    // cannot know which rows were null before.
    await queryRunner.query(
      `UPDATE "project" SET "conversation_retention_days" = 30 WHERE "conversation_retention_days" IS NULL`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project" ALTER COLUMN "conversation_retention_days" DROP DEFAULT`,
    )
  }
}
