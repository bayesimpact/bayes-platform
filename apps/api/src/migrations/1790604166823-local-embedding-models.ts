import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Local embedding models behind the `local-embeddings` feature flag.
 *
 * - `project_embedding_model`: one row per (project, local model) with the progress of the job
 *   that embeds the project's chunks with it.
 * - `document_chunk_embedding.embedding` loses its fixed 3072 size: each `model_name` stores its
 *   own dimension. Retrieval always filters on `model_name`, so a distance never mixes sizes.
 *   Written by hand: the generator emits DROP + ADD for the column, which would erase every
 *   existing vector, while ALTER TYPE keeps the data (pgvector only relaxes the typmod).
 */
export class LocalEmbeddingModels1790604166823 implements MigrationInterface {
  name = "LocalEmbeddingModels1790604166823"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "project_embedding_model" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "organization_id" uuid NOT NULL, "project_id" uuid NOT NULL, "model_name" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "total_chunks" integer NOT NULL DEFAULT '0', "processed_chunks" integer NOT NULL DEFAULT '0', "error" text, CONSTRAINT "UQ_481eacbc3c362183c80520b0f96" UNIQUE ("organization_id", "project_id", "model_name"), CONSTRAINT "PK_8845059c9f1a3e4a9e31fb70e6e" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `ALTER TABLE "document_chunk_embedding" ALTER COLUMN "embedding" TYPE vector`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only valid while every stored vector is 3072-dimensional: delete the local model rows first.
    await queryRunner.query(
      `DELETE FROM "document_chunk_embedding" WHERE "model_name" <> 'gemini-embedding-001'`,
    )
    await queryRunner.query(
      `ALTER TABLE "document_chunk_embedding" ALTER COLUMN "embedding" TYPE vector(3072)`,
    )
    await queryRunner.query(`DROP TABLE "project_embedding_model"`)
  }
}
