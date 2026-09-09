import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * The document embeddings use the pgvector extension (vector(3072) columns,
 * created by the next migration). Local and test databases get it from
 * infra/database/sql/common.sql; managed databases (Cloud SQL, RDS) and the
 * Helm chart's bundled Postgres get it here, so a fresh install does not need
 * a manual step by a database administrator.
 *
 * Idempotent: a no-op where the extension already exists. The timestamp puts
 * it right before the document-chunks migration, so it runs first on a fresh
 * database.
 */
export class PgvectorExtension1773158795872 implements MigrationInterface {
  name = "PgvectorExtension1773158795872"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`)
  }

  public async down(): Promise<void> {
    // Dropping the extension would drop every vector column with it. Keep it.
  }
}
