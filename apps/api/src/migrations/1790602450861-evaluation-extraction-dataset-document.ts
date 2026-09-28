import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Evaluation extraction dataset files move out of `document` into their own table.
 *
 * Before: a dataset CSV was a `document` row with `source_type =
 * 'evaluationExtractionDataset'` and `evaluation_extraction_dataset_document`
 * was a join table between datasets and documents.
 *
 * After: `evaluation_extraction_dataset_document` holds the file itself
 * (project scope, file name, mime type, size, storage path, upload status) and
 * `evaluation_extraction_dataset.evaluation_extraction_dataset_document_id`
 * points at the file the dataset was built from.
 *
 * The file rows keep the id of the document they replace, so the storage path
 * (which embeds that id) stays valid and the dataset foreign key can be derived
 * from the old join rows before they are dropped.
 */
export class EvaluationExtractionDatasetDocument1790602450861 implements MigrationInterface {
  name = "EvaluationExtractionDatasetDocument1790602450861"

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Remember which document each dataset was built from (the latest link wins).
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset" ADD "evaluation_extraction_dataset_document_id" uuid`,
    )
    await queryRunner.query(`
      UPDATE "evaluation_extraction_dataset" AS dataset
      SET "evaluation_extraction_dataset_document_id" = (
        SELECT link."document_id"
        FROM "evaluation_extraction_dataset_document" AS link
        WHERE link."evaluation_extraction_dataset_id" = dataset."id"
        ORDER BY link."created_at" DESC
        LIMIT 1
      )
    `)

    // 2. Turn the join table into the file table. The join rows carry no data
    //    of their own, so they are dropped before the NOT NULL columns are added.
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" DROP CONSTRAINT "FK_c7fdcf2bdf26577d3bf9c943549"`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" DROP CONSTRAINT "FK_46f73acd9bbd9e543c34a07acdc"`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" DROP CONSTRAINT "UQ_19955dfb9e8bddca21a0e49ee29"`,
    )
    await queryRunner.query(`DELETE FROM "evaluation_extraction_dataset_document"`)
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" DROP COLUMN "evaluation_extraction_dataset_id"`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" DROP COLUMN "document_id"`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" ADD "organization_id" uuid NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" ADD "project_id" uuid NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" ADD "file_name" character varying NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" ADD "mime_type" character varying NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" ADD "size" integer NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" ADD "storage_relative_path" character varying NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" ADD "upload_status" character varying NOT NULL DEFAULT 'pending'`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_d39ca4f5ca17d6346c4c0d3e42" ON "evaluation_extraction_dataset_document" ("organization_id", "project_id") `,
    )

    // 3. Move the dataset files over, keeping their ids. Soft-deleted documents
    //    are skipped: their stored file was removed when they were deleted.
    await queryRunner.query(`
      INSERT INTO "evaluation_extraction_dataset_document"
        ("id", "created_at", "updated_at", "deleted_at", "organization_id", "project_id",
         "file_name", "mime_type", "size", "storage_relative_path", "upload_status")
      SELECT
        "id", "created_at", "updated_at", "deleted_at", "organization_id", "project_id",
        COALESCE("file_name", "title"), "mime_type", COALESCE("size", 0), "storage_relative_path", "upload_status"
      FROM "document"
      WHERE "source_type" = 'evaluationExtractionDataset'
        AND "deleted_at" IS NULL
        AND "storage_relative_path" IS NOT NULL
    `)

    // 4. Datasets whose file did not survive the move lose the reference.
    await queryRunner.query(`
      UPDATE "evaluation_extraction_dataset"
      SET "evaluation_extraction_dataset_document_id" = NULL
      WHERE "evaluation_extraction_dataset_document_id" IS NOT NULL
        AND "evaluation_extraction_dataset_document_id" NOT IN (
          SELECT "id" FROM "evaluation_extraction_dataset_document"
        )
    `)
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset" ADD CONSTRAINT "FK_9329183c4f04d577db4a518c26e" FOREIGN KEY ("evaluation_extraction_dataset_document_id") REFERENCES "evaluation_extraction_dataset_document"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    )

    // 5. The source type no longer exists: the files are owned by the new table now.
    await queryRunner.query(
      `DELETE FROM "document" WHERE "source_type" = 'evaluationExtractionDataset'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Put the files back as documents.
    await queryRunner.query(`
      INSERT INTO "document"
        ("id", "created_at", "updated_at", "deleted_at", "organization_id", "project_id",
         "title", "file_name", "mime_type", "size", "storage_relative_path", "source_type", "upload_status")
      SELECT
        "id", "created_at", "updated_at", "deleted_at", "organization_id", "project_id",
        "file_name", "file_name", "mime_type", "size", "storage_relative_path", 'evaluationExtractionDataset', "upload_status"
      FROM "evaluation_extraction_dataset_document"
      ON CONFLICT ("id") DO NOTHING
    `)

    // 2. Turn the file table back into a join table, rebuilt from the dataset references.
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset" DROP CONSTRAINT "FK_9329183c4f04d577db4a518c26e"`,
    )
    await queryRunner.query(`DROP INDEX "public"."IDX_d39ca4f5ca17d6346c4c0d3e42"`)
    await queryRunner.query(`DELETE FROM "evaluation_extraction_dataset_document"`)
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" DROP COLUMN "upload_status"`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" DROP COLUMN "storage_relative_path"`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" DROP COLUMN "size"`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" DROP COLUMN "mime_type"`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" DROP COLUMN "file_name"`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" DROP COLUMN "project_id"`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" DROP COLUMN "organization_id"`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" ADD "document_id" uuid NOT NULL`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" ADD "evaluation_extraction_dataset_id" uuid NOT NULL`,
    )
    await queryRunner.query(`
      INSERT INTO "evaluation_extraction_dataset_document" ("evaluation_extraction_dataset_id", "document_id")
      SELECT "id", "evaluation_extraction_dataset_document_id"
      FROM "evaluation_extraction_dataset"
      WHERE "evaluation_extraction_dataset_document_id" IS NOT NULL
    `)
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset" DROP COLUMN "evaluation_extraction_dataset_document_id"`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" ADD CONSTRAINT "UQ_19955dfb9e8bddca21a0e49ee29" UNIQUE ("evaluation_extraction_dataset_id", "document_id")`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" ADD CONSTRAINT "FK_46f73acd9bbd9e543c34a07acdc" FOREIGN KEY ("evaluation_extraction_dataset_id") REFERENCES "evaluation_extraction_dataset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
    await queryRunner.query(
      `ALTER TABLE "evaluation_extraction_dataset_document" ADD CONSTRAINT "FK_c7fdcf2bdf26577d3bf9c943549" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
  }
}
