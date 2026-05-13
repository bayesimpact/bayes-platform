import type { MigrationInterface, QueryRunner } from "typeorm"

export class DocumentChunkRelationships1776937852125 implements MigrationInterface {
  name = "DocumentChunkRelationships1776937852125"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "document_chunk" ADD "embed_text" text NOT NULL DEFAULT ''`,
    )
    await queryRunner.query(`ALTER TABLE "document_chunk" ALTER COLUMN "embed_text" DROP DEFAULT`)
    await queryRunner.query(`ALTER TABLE "document_chunk" ADD "parent_id" uuid`)
    await queryRunner.query(`ALTER TABLE "document_chunk" ADD "prev_chunk_id" uuid`)
    await queryRunner.query(`ALTER TABLE "document_chunk" ADD "next_chunk_id" uuid`)
    await queryRunner.query(
      `ALTER TABLE "document_chunk" ADD "headings" jsonb NOT NULL DEFAULT '[]'`,
    )
    await queryRunner.query(
      `ALTER TABLE "document_chunk" ADD "captions" jsonb NOT NULL DEFAULT '[]'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "document_chunk" DROP COLUMN "captions"`)
    await queryRunner.query(`ALTER TABLE "document_chunk" DROP COLUMN "headings"`)
    await queryRunner.query(`ALTER TABLE "document_chunk" DROP COLUMN "next_chunk_id"`)
    await queryRunner.query(`ALTER TABLE "document_chunk" DROP COLUMN "prev_chunk_id"`)
    await queryRunner.query(`ALTER TABLE "document_chunk" DROP COLUMN "parent_id"`)
    await queryRunner.query(`ALTER TABLE "document_chunk" DROP COLUMN "embed_text"`)
  }
}
