import type { MigrationInterface, QueryRunner } from "typeorm"

export class AddSourceUrlToDocument1777288885700 implements MigrationInterface {
  name = "AddSourceUrlToDocument1777288885700"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "document" ADD "source_url" text`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "document" DROP COLUMN "source_url"`)
  }
}
