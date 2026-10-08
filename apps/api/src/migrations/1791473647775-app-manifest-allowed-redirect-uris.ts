import type { MigrationInterface, QueryRunner } from "typeorm"

export class AppManifestAllowedRedirectUris1791473647775 implements MigrationInterface {
  name = "AppManifestAllowedRedirectUris1791473647775"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "app_manifest" ADD "allowed_redirect_uris" jsonb NOT NULL DEFAULT '[]'`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "app_manifest" DROP COLUMN "allowed_redirect_uris"`)
  }
}
