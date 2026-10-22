import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Lexical (sparse) weights of a chunk embedding, for models that produce them (bge-m3).
 * Retrieval ranks those models by `dense + 0.3 × sparse`.
 *
 * Written by hand and kept out of the entities on purpose: TypeORM has no sparsevec type, and
 * the migration generator ignores tables without an entity, whereas a column it cannot map on
 * document_chunk_embedding would be dropped by every later migration:generate. One row per
 * embedding row, deleted with it.
 */
export class AddChunkSparseEmbeddings1791280872713 implements MigrationInterface {
  name = "AddChunkSparseEmbeddings1791280872713"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "document_chunk_sparse_embedding" (
        "document_chunk_embedding_id" uuid NOT NULL,
        "sparse_embedding" sparsevec NOT NULL,
        CONSTRAINT "PK_document_chunk_sparse_embedding" PRIMARY KEY ("document_chunk_embedding_id"),
        CONSTRAINT "FK_document_chunk_sparse_embedding_embedding" FOREIGN KEY ("document_chunk_embedding_id")
          REFERENCES "document_chunk_embedding"("id") ON DELETE CASCADE
      )`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "document_chunk_sparse_embedding"`)
  }
}
