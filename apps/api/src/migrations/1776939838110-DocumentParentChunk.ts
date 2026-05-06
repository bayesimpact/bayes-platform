import type { MigrationInterface, QueryRunner } from "typeorm"

export class DocumentParentChunk1776939838110 implements MigrationInterface {
  name = "DocumentParentChunk1776939838110"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "document_parent_chunk" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "organization_id" uuid NOT NULL, "project_id" uuid NOT NULL, "document_id" uuid NOT NULL, "content" text NOT NULL, "embed_text" text NOT NULL, "chunk_index" integer NOT NULL, "prev_chunk_id" uuid, "next_chunk_id" uuid, "headings" jsonb NOT NULL DEFAULT '[]', "captions" jsonb NOT NULL DEFAULT '[]', CONSTRAINT "PK_95ae2644944c65be55e53020682" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_9891779d036195a9b4ffceee1f" ON "document_parent_chunk" ("organization_id", "project_id") `,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_9891779d036195a9b4ffceee1f"`)
    await queryRunner.query(`DROP TABLE "document_parent_chunk"`)
  }
}
