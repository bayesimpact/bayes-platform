import type { MigrationInterface, QueryRunner } from "typeorm"

export class DocumentSourceTags1793113637000 implements MigrationInterface {
  name = "DocumentSourceTags1793113637000"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "document_source_document_tag" ("document_source_id" uuid NOT NULL, "document_tag_id" uuid NOT NULL, CONSTRAINT "PK_4a4eadb589919c7f49e1f2cf035" PRIMARY KEY ("document_source_id", "document_tag_id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_5deb8a338500840f481e7d220b" ON "document_source_document_tag" ("document_source_id") `,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_6098e241d411f49c48634352ea" ON "document_source_document_tag" ("document_tag_id") `,
    )
    await queryRunner.query(
      `ALTER TABLE "document_source_document_tag" ADD CONSTRAINT "FK_5deb8a338500840f481e7d220b3" FOREIGN KEY ("document_source_id") REFERENCES "document_source"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    )
    await queryRunner.query(
      `ALTER TABLE "document_source_document_tag" ADD CONSTRAINT "FK_6098e241d411f49c48634352eaf" FOREIGN KEY ("document_tag_id") REFERENCES "document_tag"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "document_source_document_tag" DROP CONSTRAINT "FK_6098e241d411f49c48634352eaf"`,
    )
    await queryRunner.query(
      `ALTER TABLE "document_source_document_tag" DROP CONSTRAINT "FK_5deb8a338500840f481e7d220b3"`,
    )
    await queryRunner.query(`DROP INDEX "public"."IDX_6098e241d411f49c48634352ea"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_5deb8a338500840f481e7d220b"`)
    await queryRunner.query(`DROP TABLE "document_source_document_tag"`)
  }
}
