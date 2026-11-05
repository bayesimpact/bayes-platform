import type { MigrationInterface, QueryRunner } from "typeorm"

export class AppManifestCatalog1793869251272 implements MigrationInterface {
  name = "AppManifestCatalog1793869251272"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "app_manifest" ADD "app_url" character varying`)
    await queryRunner.query(
      `ALTER TABLE "app_manifest" ADD "listed_in_catalog" boolean NOT NULL DEFAULT false`,
    )
    await queryRunner.query(
      `ALTER TABLE "app_manifest" ADD "install_instructions" character varying`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "app_manifest" DROP COLUMN "install_instructions"`)
    await queryRunner.query(`ALTER TABLE "app_manifest" DROP COLUMN "listed_in_catalog"`)
    await queryRunner.query(`ALTER TABLE "app_manifest" DROP COLUMN "app_url"`)
  }
}
