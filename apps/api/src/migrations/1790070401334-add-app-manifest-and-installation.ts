import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Apps V0 AppManifest back-office CRUD: global app catalog plus a stub
 * installation table so delete can refuse manifests that still have active
 * installs. Further installation columns land in a later ticket.
 */
export class AddAppManifestAndInstallation1790070401334 implements MigrationInterface {
  name = "AddAppManifestAndInstallation1790070401334"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "app_manifest" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "name" character varying NOT NULL, "slug" character varying NOT NULL, "description" character varying, "logo_url" character varying, "grantable_permissions" jsonb NOT NULL DEFAULT '[]', CONSTRAINT "PK_6e2ab16754df233cace07052d15" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_7cdce8b0f49b354e07e5ce612b" ON "app_manifest" ("slug") WHERE "deleted_at" IS NULL`,
    )
    await queryRunner.query(
      `CREATE TABLE "app_installation" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "app_manifest_id" uuid NOT NULL, "project_id" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'active', CONSTRAINT "PK_9613b9b5a6933548b6425429763" PRIMARY KEY ("id"))`,
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_app_installation_manifest_status" ON "app_installation" ("app_manifest_id", "status") `,
    )
    await queryRunner.query(
      `ALTER TABLE "app_installation" ADD CONSTRAINT "FK_437449d4809b2e9aa1ee595aa6a" FOREIGN KEY ("app_manifest_id") REFERENCES "app_manifest"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "app_installation" DROP CONSTRAINT "FK_437449d4809b2e9aa1ee595aa6a"`,
    )
    await queryRunner.query(`DROP INDEX "public"."IDX_app_installation_manifest_status"`)
    await queryRunner.query(`DROP TABLE "app_installation"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_7cdce8b0f49b354e07e5ce612b"`)
    await queryRunner.query(`DROP TABLE "app_manifest"`)
  }
}
